import os, re, time, secrets, shutil, subprocess, asyncio, threading, json, zipfile, hashlib, shlex
import pty, fcntl, struct, termios
import psutil, mimetypes
from datetime import datetime
import logging
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request, Response as FastResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError, OperationalError
from app.utils.system import run_command
from app.database import init_db, engine
from app.models import User, AuditLog, TokenBlacklist, Setting, FileLink as FileLinkModel
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin,
    limiter, check_account_locked, record_failed_attempt, reset_lockout,
    revoke_token, add_audit_log, validate_password_strength,
    clear_auth_cookies, set_auth_cookies, validate_csrf,
)
from app.apps import APPS, get_all_status, get_script_path
from app.browser_proxy import _proxy_request, extract_target_from_view, _is_private_host
from app import settings_cache
from pathlib import Path
from pydantic import BaseModel, field_validator
from datetime import timedelta
from contextlib import asynccontextmanager

logger = logging.getLogger("cloudbanana.main")

# Module-level lock for sequential nginx operations (prevent race conditions)
_nginx_lock = asyncio.Lock()

app = FastAPI(title="CloudBanana DE API", version="0.1.0")

# ---- Rate Limiter ----
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---- CSRF Middleware ----
@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        # Skip CSRF for auth and serve endpoints
        if path in ("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/logout") \
                or path.startswith("/api/v1/files/serve/"):
            return await call_next(request)
        # Graceful CSRF: only validate if the csrf_token cookie exists
        # The cookie is set by set_auth_cookies() during login (future enhancement).
        # Until then, skip validation to avoid breaking all POST requests.
        csrf_cookie = request.cookies.get("csrf_token", "")
        if csrf_cookie and not validate_csrf(request):
            add_audit_log("csrf_failure", detail=f"CSRF validation failed for {request.method} {path}", ip_address=request.client.host if request.client else "")
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF validation failed. Missing or invalid X-CSRF-Token header."}
            )
    response = await call_next(request)
    # CSRF token stays static per session — rotation removed because it caused
    # race conditions with rapid successive POST requests on HTTP connections.
    return response

# ---- Security Headers Middleware ----
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    # Security headers for API responses
    # Skip X-Frame-Options for proxy view (BananaBrowser renders in iframe)
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/v1/proxy/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ---- CORS (same-origin only — frontend & API via same nginx) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    expose_headers=["Content-Type"],
)

# ---- Request Timeout Middleware ----
REQUEST_TIMEOUT = 120

@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1/terminal/ws"):
        return await call_next(request)
    try:
        return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT)
    except asyncio.TimeoutError:
        logger.warning(f"Request timeout: {request.method} {request.url.path}")
        return JSONResponse(
            status_code=503,
            content={"detail": "Request timed out. Please try again."}
        )

def _db_retry(max_retries=3, delay=0.5):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except OperationalError as e:
                    if "database is locked" in str(e) and attempt < max_retries - 1:
                        last_exc = e
                        await asyncio.sleep(delay * (attempt + 1))
                        continue
                    raise
            raise last_exc
        return wrapper
    return decorator

# Max upload file size: 100 MB
def _max_upload_bytes() -> int:
    return settings_cache.get_int("max_upload_size_mb", 100) * 1024 * 1024

@app.on_event("startup")
def on_startup():
    init_db()
    settings_cache.load()
    # Cleanup expired blacklisted tokens and old audit logs
    with Session(engine) as session:
        expired = session.exec(
            select(TokenBlacklist).where(TokenBlacklist.expires_at < datetime.utcnow())
        ).all()
        for t in expired:
            session.delete(t)
        cutoff = datetime.utcnow() - timedelta(days=30)
        old_logs = session.exec(
            select(AuditLog).where(AuditLog.created_at < cutoff)
        ).all()
        for log in old_logs:
            session.delete(log)
        session.commit()
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired blacklisted tokens")
        if old_logs:
            logger.info(f"Cleaned up {len(old_logs)} old audit logs")
    # Cleanup stale in-memory tasks
    now = time.time()
    for tasks_dict in (_install_tasks, _wget_tasks):
        stale = [tid for tid, t in tasks_dict.items()
                 if t.get("status") in ("done", "error") and now - t.get("_ts", now) > 3600]
        for tid in stale:
            del tasks_dict[tid]
    logger.info(f"Cleaned up {len(stale)} stale in-memory tasks")

def background_installer(script_path: str):
    if os.path.exists(script_path):
        ok, out = run_command(["bash", script_path], timeout=300)
        if not ok:
            logger.error(f"Background installer failed for {script_path}: {out}")
    else:
        logger.error(f"Background installer script not found: {script_path}")

class RegisterBody(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v):
        if not re.match(r"^[a-zA-Z0-9_]{3,32}$", v):
            raise ValueError("Username must be 3-32 chars: letters, numbers, underscores only")
        return v

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        err = validate_password_strength(v)
        if err:
            raise ValueError(err)
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format")
        return v

class LoginBody(BaseModel):
    username: str
    password: str

class CreateUserBody(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    avatar: str | None = None

    @field_validator("username")
    @classmethod
    def valid_username(cls, v):
        if not re.match(r"^[a-zA-Z0-9_]{3,32}$", v):
            raise ValueError("Username must be 3-32 chars: letters, numbers, underscores only")
        return v

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        err = validate_password_strength(v)
        if err:
            raise ValueError(err)
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v):
        if v not in ("admin", "user"):
            raise ValueError("Role must be admin or user")
        return v

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, v):
        err = validate_password_strength(v)
        if err:
            raise ValueError(err)
        return v

class UpdateUserBody(BaseModel):
    name: str | None = None
    password: str | None = None
    avatar: str | None = None
    role: str | None = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        if v is not None:
            err = validate_password_strength(v)
            if err:
                raise ValueError(err)
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v):
        if v is not None and v not in ("admin", "user"):
            raise ValueError("Role must be admin or user")
        return v

@app.get("/api/v1/health")
async def health_check():
    db_ok = False
    try:
        with Session(engine) as session:
            session.exec(select(User).limit(1))
            db_ok = True
    except Exception:
        pass
    return {"status": "ok" if db_ok else "degraded", "database": "connected" if db_ok else "error"}

@app.get("/api/v1/auth/check")
async def check_admin_exists():
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.role == "admin")).first()
        return {"admin_exists": admin is not None}

@app.post("/api/v1/auth/register")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_register", "3/hour"))
async def register_admin(request: Request, body: RegisterBody):
    client_ip = request.client.host if request.client else "unknown"
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.role == "admin")).first()
        if admin:
            add_audit_log("register_attempt", body.username, "Admin already exists", client_ip)
            raise HTTPException(status_code=400, detail="Admin already exists")
        user = User(
            username=body.username,
            email=body.email,
            hashed_password=hash_password(body.password),
            role="admin"
        )
        session.add(user)
        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            add_audit_log("register_failed", body.username, "Username or email taken", client_ip)
            raise HTTPException(status_code=400, detail="Username or email already taken")
    add_audit_log("register_success", body.username, "Admin registered", client_ip)
    return {"status": "success", "message": "Admin registered successfully"}

@app.post("/api/v1/auth/login")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_login", "10/minute"))
async def login(request: Request, body: LoginBody):
    client_ip = request.client.host if request.client else "unknown"

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == body.username)).first()
        if not user or not verify_password(body.password, user.hashed_password):
            record_failed_attempt(body.username)
            # Lock out if threshold reached
            if check_account_locked(body.username):
                add_audit_log("login_locked", body.username, "Account locked", client_ip)
                raise HTTPException(status_code=429, detail="Account temporarily locked. Try again in 15 minutes.")
            add_audit_log("login_failed", body.username, "Invalid credentials", client_ip)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Successful login
        reset_lockout(body.username)
        token = create_access_token({"sub": user.username, "role": user.role})
        user_agent = request.headers.get("user-agent", "")
        add_audit_log("login_success", user.username, user_agent[:500], client_ip)
        resp = JSONResponse({"access_token": token, "token_type": "bearer", "role": user.role})
        set_auth_cookies(resp, token)
        return resp

@app.get("/api/v1/auth/last-access")
async def get_last_access(user: User = Depends(get_current_user)):
    """Return the last successful login info (IP, browser, timestamp)."""
    with Session(engine) as session:
        log = session.exec(
            select(AuditLog).where(
                AuditLog.username == user.username,
                AuditLog.action == "login_success"
            ).order_by(AuditLog.created_at.desc()).limit(1)
        ).first()
        if not log:
            return {"ip": "", "browser": "", "timestamp": ""}
        # Also get geolocation for the IP
        location = ""
        if log.ip_address:
            try:
                import urllib.request
                loop = asyncio.get_running_loop()
                def _fetch():
                    req = urllib.request.Request(
                        f"http://ip-api.com/json/{log.ip_address}?fields=status,country,city",
                        headers={"User-Agent": "CloudBanana/1.0"})
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        return json.loads(resp.read())
                geo = await loop.run_in_executor(None, _fetch)
                if geo.get("status") == "success":
                    parts = []
                    if geo.get("city"):
                        parts.append(geo["city"])
                    if geo.get("country"):
                        parts.append(geo["country"])
                    location = ", ".join(parts)
            except Exception:
                pass
        return {
            "ip": log.ip_address,
            "browser": log.detail,
            "timestamp": log.created_at.isoformat(),
            "location": location,
        }

@app.post("/api/v1/auth/logout")
async def logout(request: Request, user: User = Depends(get_current_user)):
    """Logout: revoke current token's JTI so it can't be reused."""
    from jose import jwt
    from app.auth import _SECRET_KEY, ALGORITHM
    token = None
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("token")
    if token:
        try:
            payload = jwt.decode(token, _SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload.get("jti", "")
            if jti:
                from datetime import datetime
                exp = payload.get("exp", datetime.utcnow().timestamp())
                revoke_token(jti, datetime.fromtimestamp(exp))
        except Exception:
            pass
    add_audit_log("logout", user.username, "User logged out")
    return {"status": "success", "message": "Logged out successfully"}

@app.post("/api/v1/auth/change-password")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_change_password", "5/minute"))
async def change_password(request: Request, body: ChangePasswordBody, user: User = Depends(get_current_user)):
    if not verify_password(body.current_password, user.hashed_password):
        add_audit_log("change_password_failed", user.username, "Incorrect current password")
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    # Re-query user in a fresh session to avoid DetachedInstanceError
    with Session(engine) as session:
        db_user = session.get(User, user.id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        db_user.hashed_password = hash_password(body.new_password)
        session.add(db_user)
        session.commit()
    add_audit_log("change_password", user.username, "Password changed")
    return {"status": "success", "message": "Password changed successfully"}

@app.get("/api/v1/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "name": user.name, "avatar": user.avatar, "home": home}

@app.get("/api/v1/auth/users/public")
async def list_users_public():
    """Public endpoint — no auth required. Used by the login screen to show the user picker."""
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        return [{"id": u.id, "username": u.username, "role": u.role, "name": u.name, "avatar": u.avatar} for u in users]

@app.get("/api/v1/auth/users")
async def list_users(admin: User = Depends(require_admin)):
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        return [
            {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "name": u.name, "avatar": u.avatar, "created_at": u.created_at.isoformat()}
            for u in users
        ]

@app.post("/api/v1/auth/users")
async def create_user(body: CreateUserBody, admin: User = Depends(require_admin)):
    with Session(engine) as session:
        user = User(
            username=body.username,
            email=body.email,
            hashed_password=hash_password(body.password),
            role=body.role,
            avatar=body.avatar
        )
        session.add(user)
        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=400, detail="Username or email already taken")
        except Exception:
            session.rollback()
            logger.exception("Error creating user")
            raise HTTPException(status_code=500, detail="Failed to create user")
    return {"status": "success", "message": f"User {body.username} created"}

@app.patch("/api/v1/auth/users/{user_id}")
async def update_user(user_id: int, body: UpdateUserBody, admin: User = Depends(require_admin)):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if body.name is not None:
            user.name = body.name
        if body.password is not None:
            user.hashed_password = hash_password(body.password)
        if body.avatar is not None:
            user.avatar = body.avatar
        if body.role is not None:
            user.role = body.role
        session.add(user)
        session.commit()
        session.refresh(user)
    return {"status": "success", "message": "User updated"}

@app.get("/api/v1/auth/avatar/{user_id}")
async def get_avatar(user_id: int):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user or not user.avatar:
            raise HTTPException(status_code=404, detail="Avatar not found")
    avatar = user.avatar
    from urllib.parse import parse_qs, urlparse
    # Handle avatar URLs that may be full URLs or relative paths to /api/v1/files/raw
    if "/api/v1/files/raw" in avatar:
        parsed = urlparse(avatar)
        qs = parse_qs(parsed.query)
        path = qs.get("path", [None])[0]
        if not path:
            raise HTTPException(status_code=404, detail="Avatar file not found")
        safe = safe_path(path)
        if not safe.is_file():
            raise HTTPException(status_code=404, detail="Avatar file not found")
        media_type, _ = mimetypes.guess_type(str(safe))
        return FileResponse(str(safe), media_type=media_type or "image/webp")
    if os.path.isfile(avatar):
        media_type, _ = mimetypes.guess_type(avatar)
        return FileResponse(avatar, media_type=media_type or "image/webp")
    raise HTTPException(status_code=404, detail="Avatar file not found")

@app.get("/api/v1/system/stats")
async def get_system_stats(user: User = Depends(get_current_user)):
    mem = await asyncio.to_thread(psutil.virtual_memory)
    swap = await asyncio.to_thread(psutil.swap_memory)
    disks = []
    for part in await asyncio.to_thread(psutil.disk_partitions):
        if part.fstype in ('tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'proc', 'sysfs', 'cgroup', 'cgroup2', 'hugetlbfs', 'mqueue', 'pstore', 'securityfs', 'efivarfs', 'tracefs', 'debugfs', 'configfs', 'autofs', 'devpts', 'fusectl', 'bpf'):
            continue
        try:
            usage = await asyncio.to_thread(psutil.disk_usage, part.mountpoint)
            disks.append({
                "mount": part.mountpoint,
                "device": part.device,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent,
            })
        except Exception:
            logger.warning("Failed to get disk usage for a partition", exc_info=True)

    cpu = await asyncio.to_thread(psutil.cpu_percent, 0)
    cpu_per_core = await asyncio.to_thread(psutil.cpu_percent, 0, percpu=True)
    cpu_cores = await asyncio.to_thread(psutil.cpu_count)
    cpu_phys = await asyncio.to_thread(psutil.cpu_count, logical=False)
    try:
        freq = await asyncio.to_thread(psutil.cpu_freq)
        cpu_freq = freq.current if freq else 0
        cpu_freq_max = freq.max if freq else 0
    except Exception:
        logger.debug("Could not read CPU frequency")
        cpu_freq = 0
        cpu_freq_max = 0
    load_1, load_5, load_15 = await asyncio.to_thread(psutil.getloadavg)

    disk = await asyncio.to_thread(psutil.disk_usage, '/')
    uptime = await asyncio.to_thread(psutil.boot_time)

    net = await asyncio.to_thread(psutil.net_io_counters)
    procs = len(await asyncio.to_thread(psutil.pids))

    try:
        temps = await asyncio.to_thread(psutil.sensors_temperatures)
        temperature = {k: [{"current": s.current, "high": s.high, "critical": s.critical} for s in v] for k, v in temps.items()} if temps else None
    except Exception:
        logger.debug("Could not read temperature sensors")
        temperature = None

    return {
        "cpu": cpu,
        "cpu_per_core": cpu_per_core,
        "cpu_cores": cpu_cores,
        "cpu_phys": cpu_phys,
        "cpu_freq": cpu_freq,
        "cpu_freq_max": cpu_freq_max,
        "load_1": load_1,
        "load_5": load_5,
        "load_15": load_15,
        "ram_percent": mem.percent,
        "ram_used": mem.used,
        "ram_total": mem.total,
        "ram_available": mem.available,
        "ram_free": mem.free,
        "ram_cached": getattr(mem, 'cached', 0),
        "ram_buffers": getattr(mem, 'buffers', 0),
        "swap_percent": swap.percent,
        "swap_used": swap.used,
        "swap_total": swap.total,
        "disks": disks,
        "net_bytes_sent": net.bytes_sent,
        "net_bytes_recv": net.bytes_recv,
        "net_packets_sent": net.packets_sent,
        "net_packets_recv": net.packets_recv,
        "processes": procs,
        "uptime_seconds": int(time.time() - uptime),
        "disk_percent": disk.percent,
        "temperature": temperature,
    }


@app.get("/api/v1/system/processes")
async def get_system_processes(user: User = Depends(get_current_user)):
    procs = []
    for p in await asyncio.to_thread(psutil.process_iter, ['pid', 'name', 'cpu_percent', 'memory_percent', 'memory_info', 'status', 'username', 'create_time']):
        try:
            pinfo = await asyncio.to_thread(lambda p=p: p.info)
            mem_mb = round(pinfo['memory_info'].rss / (1024 * 1024), 1) if pinfo['memory_info'] else 0
            procs.append({
                "pid": pinfo['pid'],
                "name": pinfo['name'] or '',
                "cpu": round(pinfo['cpu_percent'] or 0, 1),
                "mem": round((pinfo['memory_percent'] or 0), 1),
                "mem_mb": mem_mb,
                "status": pinfo['status'] or '',
                "user": pinfo['username'] or '',
                "created": datetime.fromtimestamp(pinfo['create_time']).isoformat() if pinfo['create_time'] else '',
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, TypeError):
            pass
    return procs

@app.get("/api/v1/apps/status")
async def list_apps(user: User = Depends(get_current_user)):
    return get_all_status()

@app.post("/api/v1/apps/install/{app_id}")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_app_install", "5/minute"))
async def install_app(request: Request, app_id: str, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    app_def = next((a for a in APPS if a["id"] == app_id), None)
    if not app_def:
        raise HTTPException(status_code=400, detail="Application not supported")
    script_path = get_script_path(app_def["script"])
    if not os.path.exists(script_path):
        raise HTTPException(status_code=500, detail="Installation script not found")
    background_tasks.add_task(background_installer, script_path)
    return {"status": "success", "message": f"Installing {app_def['name']} in the background. Refresh to see version."}

# ========== Custom App Installer (HTML apps) ==========

_install_tasks: dict[str, dict] = {}
_install_tasks_lock = threading.Lock()

class InstallUrlBody(BaseModel):
    url: str

class InstallUploadBody(BaseModel):
    path: str
    app_name: str

@app.get("/api/v1/apps/installed")
async def list_installed_apps(user: User = Depends(get_current_user)):
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    apps_dir = Path(home) / "applications"
    apps = []
    # Use sudo find to list app directories (may be owned by different user)
    result = subprocess.run(
        ["sudo", "bash", "-c", f"find {shlex.quote(str(apps_dir))} -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort"],
        capture_output=True, text=True, timeout=15
    )
    for dir_path in result.stdout.strip().split('\n'):
        if not dir_path.strip():
            continue
        child = Path(dir_path)
        name = child.name
        # Find HTML file via sudo find
        html_result = subprocess.run(
            ["sudo", "bash", "-c", f"find {shlex.quote(str(child))} -maxdepth 1 -name '*.html' -type f 2>/dev/null | head -1"],
            capture_output=True, text=True, timeout=10
        )
        html_file = html_result.stdout.strip() if html_result.stdout.strip() else None
        if not html_file:
            continue
        info = {"name": name, "title": name, "description": ""}
        # Read manifest via sudo cat
        manifest_result = subprocess.run(
            ["sudo", "bash", "-c", f"cat {shlex.quote(str(child / 'manifest.json'))} 2>/dev/null"],
            capture_output=True, text=True, timeout=10
        )
        if manifest_result.returncode == 0 and manifest_result.stdout.strip():
            try:
                m = json.loads(manifest_result.stdout)
                info.update(m)
            except Exception:
                pass
        # Find icon via sudo
        icon_path = None
        for ext in ['.svg', '.png', '.jpg', '.jpeg', '.webp']:
            icon_check = subprocess.run(
                ["sudo", "bash", "-c", f"test -f {shlex.quote(str(child / f'icon{ext}'))}"],
                capture_output=True, timeout=5
            )
            if icon_check.returncode == 0:
                icon_path = str(child / f"icon{ext}")
                break
        apps.append({
            "name": name,
            "title": info.get("title", info["name"]),
            "description": info.get("description", ""),
            "html_path": html_file,
            "icon_path": icon_path,
            "version": info.get("version", ""),
            "author": info.get("author", ""),
        })
    return {"apps": apps}

@app.get("/api/v1/apps/install/status/{task_id}")
async def get_install_status(task_id: str, user: User = Depends(get_current_user)):
    t = _install_tasks.get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": t.get("status", "unknown"), "output": t.get("output", "")}

@app.post("/api/v1/apps/install")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_git_clone", "5/minute"))
async def install_from_git(request: Request, body: InstallUrlBody, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    from urllib.parse import urlparse
    if not re.match(r'^https?://', body.url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    parsed = urlparse(body.url)
    if parsed.hostname and _is_private_host(parsed.hostname):
        raise HTTPException(status_code=403, detail="Cannot clone from internal/private hosts")
    tid = secrets.token_hex(8)
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    apps_dir = Path(home) / "applications"
    # Use sudo to create directory (cloudbanana user may not have write permission)
    subprocess.run(["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(apps_dir))}"], capture_output=True, timeout=10)
    with _install_tasks_lock:
        _install_tasks[tid] = {"status": "running", "output": "Starting...\n", "_ts": time.time()}
    background_tasks.add_task(_do_git_install, tid, body.url, apps_dir)
    return {"task_id": tid, "status": "running"}

@app.post("/api/v1/apps/install/upload")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_app_install", "5/minute"))
async def install_from_upload(request: Request, body: InstallUploadBody, user: User = Depends(get_current_user)):
    src = safe_path(body.path, user)
    if not src.exists() or not src.is_file():
        raise HTTPException(status_code=400, detail="Uploaded file not found")
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    apps_dir = Path(home) / "applications"
    dest_dir = apps_dir / body.app_name
    # Use sudo for all filesystem operations (cloudbanana user lacks write permission)
    subprocess.run(["sudo", "bash", "-c", f"rm -rf {shlex.quote(str(dest_dir))} && mkdir -p {shlex.quote(str(dest_dir))}"], capture_output=True, timeout=10)
    try:
        import zipfile
        # Copy ZIP to /tmp first, then extract via sudo
        tmp_zip = Path(f"/tmp/app_upload_{body.app_name}.zip")
        shutil.copy2(src, tmp_zip)
        subprocess.run(["sudo", "bash", "-c", f"unzip -o {shlex.quote(str(tmp_zip))} -d {shlex.quote(str(dest_dir))}"], capture_output=True, timeout=30)
        tmp_zip.unlink(missing_ok=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract ZIP: {str(e)}")
    # Find HTML file and create manifest (use sudo find + cat)
    result = subprocess.run(["sudo", "bash", "-c", f"find {shlex.quote(str(dest_dir))} -maxdepth 1 -name '*.html' -type f 2>/dev/null; find {shlex.quote(str(dest_dir))} -name '*.html' -type f 2>/dev/null | head -5"], capture_output=True, text=True, timeout=10)
    html_files = [f for f in result.stdout.strip().split('\n') if f.strip()]
    if not html_files:
        subprocess.run(["sudo", "bash", "-c", f"rm -rf {shlex.quote(str(dest_dir))}"], capture_output=True, timeout=10)
        raise HTTPException(status_code=400, detail="No HTML file found in ZIP")
    # Create manifest if not exists
    manifest_path = dest_dir / "manifest.json"
    manifest_exists = subprocess.run(["sudo", "bash", "-c", f"test -f {shlex.quote(str(manifest_path))}"], capture_output=True, timeout=5).returncode == 0
    if not manifest_exists:
        manifest_json = json.dumps({"name": body.app_name, "title": body.app_name, "description": "Installed from ZIP"}, indent=2)
        subprocess.run(["sudo", "bash", "-c", f"cat > {shlex.quote(str(manifest_path))}"], input=manifest_json.encode(), capture_output=True, timeout=10)
    return {"status": "success", "message": f"App {body.app_name} installed"}

@app.delete("/api/v1/apps/installed/{app_name}")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_app_install", "5/minute"))
async def uninstall_app(request: Request, app_name: str, user: User = Depends(get_current_user)):
    # Basic path traversal prevention
    if not re.match(r'^[a-zA-Z0-9_.-]+$', app_name):
        raise HTTPException(status_code=400, detail="Invalid app name")
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    app_dir = Path(home) / "applications" / app_name
    # Check if exists via sudo
    exists = subprocess.run(["sudo", "bash", "-c", f"test -d {shlex.quote(str(app_dir))}"], capture_output=True, timeout=5).returncode == 0
    if not exists:
        raise HTTPException(status_code=404, detail="App not found")
    # Use sudo to remove directory
    result = subprocess.run(["sudo", "bash", "-c", f"rm -rf {shlex.quote(str(app_dir))}"], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Failed to uninstall app: {result.stderr}")
    return {"status": "success", "message": f"App {app_name} uninstalled"}

def _do_git_install(tid: str, url: str, apps_dir: Path):
    repo_name = url.rstrip('/').split('/')[-1].replace('.git', '')
    dest = apps_dir / repo_name
    try:
        with _install_tasks_lock:
            _install_tasks[tid]["output"] += f"Cloning {url}...\n"
        # Use sudo bash -c to clone (cloudbanana user may not have write permission)
        result = subprocess.run(
            ["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(dest.parent))} && git clone --depth 1 -- {shlex.quote(url)} {shlex.quote(str(dest))}"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            with _install_tasks_lock:
                _install_tasks[tid].update({"status": "error", "_ts": time.time()})
                _install_tasks[tid]["output"] += f"Git clone failed: {result.stderr}\n"
            return
        with _install_tasks_lock:
            _install_tasks[tid]["output"] += f"Cloned to {dest}\n"
        # Find HTML files via sudo find
        find_result = subprocess.run(
            ["sudo", "bash", "-c", f"find {shlex.quote(str(dest))} -maxdepth 1 -name '*.html' -type f 2>/dev/null; find {shlex.quote(str(dest))} -name '*.html' -type f 2>/dev/null | head -5"],
            capture_output=True, text=True, timeout=10
        )
        html_files = [f for f in find_result.stdout.strip().split('\n') if f.strip()]
        if not html_files:
            with _install_tasks_lock:
                _install_tasks[tid].update({"status": "error", "_ts": time.time()})
                _install_tasks[tid]["output"] += "No HTML file found in repository\n"
            subprocess.run(["sudo", "bash", "-c", f"rm -rf {shlex.quote(str(dest))}"], capture_output=True, timeout=10)
            return
        # Create manifest via sudo if not exists
        manifest_exists = subprocess.run(
            ["sudo", "bash", "-c", f"test -f {shlex.quote(str(dest / 'manifest.json'))}"],
            capture_output=True, timeout=5
        ).returncode == 0
        if not manifest_exists:
            manifest_json = json.dumps({
                "name": repo_name, "title": repo_name,
                "description": "Installed from " + url
            }, indent=2)
            subprocess.run(
                ["sudo", "bash", "-c", f"cat > {shlex.quote(str(dest / 'manifest.json'))}"],
                input=manifest_json.encode(), capture_output=True, timeout=10
            )
        with _install_tasks_lock:
            _install_tasks[tid]["output"] += f"Found {html_files[0].split('/')[-1]}\n"
            _install_tasks[tid].update({"status": "done", "_ts": time.time()})
            _install_tasks[tid]["output"] += "Install complete!\n"
    except subprocess.TimeoutExpired:
        with _install_tasks_lock:
            _install_tasks[tid].update({"status": "error", "_ts": time.time()})
            _install_tasks[tid]["output"] += "Git clone timed out\n"
    except Exception as e:
        with _install_tasks_lock:
            _install_tasks[tid].update({"status": "error", "_ts": time.time()})
            _install_tasks[tid]["output"] += f"Error: {str(e)}\n"

class CreateFolderBody(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def valid_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", v):
            raise ValueError("Invalid folder name")
        return v

class SubdomainBody(BaseModel):
    domain: str
    subdomain: str
    target_dir: str = "/var/www"

    @field_validator("domain")
    @classmethod
    def valid_domain(cls, v):
        if not re.match(r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid domain")
        return v

    @field_validator("subdomain")
    @classmethod
    def valid_subdomain(cls, v):
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", v):
            raise ValueError("Invalid subdomain name")
        return v

@app.get("/api/v1/www")
async def list_www(user: User = Depends(get_current_user)):
    www = Path("/var/www")
    if not www.exists():
        return {"items": []}
    items = []
    for child in sorted(www.iterdir()):
        items.append({
            "name": child.name,
            "is_dir": child.is_dir(),
            "size": child.stat().st_size if child.is_file() else 0,
        })
    return {"items": items}

@app.post("/api/v1/www")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_www_folder", "10/minute"))
async def create_www_folder(request: Request, body: CreateFolderBody, user: User = Depends(get_current_user)):
    folder = Path("/var/www") / body.name
    if folder.exists():
        raise HTTPException(status_code=400, detail="Folder already exists")
    folder.mkdir(parents=True, exist_ok=True)
    return {"status": "success", "message": f"Folder /var/www/{body.name} created"}

@app.post("/api/v1/subdomain")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_subdomain", "10/minute"))
async def create_subdomain(request: Request, body: SubdomainBody, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    target = Path(body.target_dir)
    config = f"""server {{
    listen 80;
    server_name {body.subdomain}.{body.domain};

    root {target / body.subdomain};
    index index.html index.htm index.php;

    location / {{
        try_files $uri $uri/ =404;
    }}
}}
"""
    config_path = Path(f"/etc/nginx/sites-available/{body.subdomain}.{body.domain}")
    config_path.write_text(config)
    enabled = Path(f"/etc/nginx/sites-enabled/{body.subdomain}.{body.domain}")
    if not enabled.exists():
        enabled.symlink_to(config_path)
    background_tasks.add_task(lambda: run_command(["nginx", "-t"]) and run_command(["systemctl", "reload", "nginx"]))
    return {"status": "success", "message": f"Subdomain {body.subdomain}.{body.domain} configured"}

@app.post("/api/v1/nginx/test")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_nginx_test", "10/minute"))
async def test_nginx_config(request: Request, user = Depends(get_current_user)):
    # Use sudo because nginx -t requires root for reading /run/nginx.pid
    result = subprocess.run(["sudo", "nginx", "-t"], capture_output=True, text=True)
    output = (result.stdout + result.stderr).strip()
    if result.returncode == 0:
        return {"status": "ok", "message": output}
    else:
        return {"status": "error", "message": output}

# ========== File Manager API ==========

class FileAction(BaseModel):
    path: str

class WriteFileBody(BaseModel):
    path: str
    content: str

class RenameBody(BaseModel):
    path: str
    new_name: str

class CopyMoveBody(BaseModel):
    path: str
    dest: str

def safe_path(user_path: str, user: User | None = None) -> Path:
    # Normalize the path textually without accessing filesystem (cloudbanana user
    # may not have permission to resolve symlinks in protected directories like /root/)
    p = Path(os.path.normpath(user_path))
    if not p.is_absolute():
        raise HTTPException(status_code=400, detail="Path must be absolute")
    # Non-admin users are restricted to their home directory
    if user and user.role != "admin":
        # Use normpath for home comparison too (no filesystem access)
        home = Path(os.path.normpath(f"/{user.username}" if user.username == "root" else f"/home/{user.username}"))
        if not str(p).startswith(str(home)):
            raise HTTPException(status_code=403, detail="Access denied: path outside home directory")
    return p

def _sudo_exists(path: str, flag: str = "-e") -> bool:
    """Check if a path exists using sudo (cloudbanana user may lack permission)."""
    result = subprocess.run(
        ["sudo", "bash", "-c", f"test {flag} {shlex.quote(path)}"],
        capture_output=True, timeout=10
    )
    return result.returncode == 0

def _sudo_read(path: str) -> str:
    """Read file content via sudo cat."""
    result = subprocess.run(
        ["sudo", "bash", "-c", f"cat {shlex.quote(path)}"],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=404, detail="File not found")
    return result.stdout

@app.get("/api/v1/files")
async def list_files(path: str = "/", user = Depends(get_current_user)):
    p = safe_path(path, user)
    import shlex
    # Use sudo to check if directory exists (cloudbanana user may not have access)
    check = subprocess.run(["sudo", "bash", "-c", f"test -d {shlex.quote(str(p))}"], capture_output=True, timeout=10)
    if check.returncode != 0:
        raise HTTPException(status_code=404, detail="Directory not found")
    # Use sudo to list directory contents (cloudbanana user may not have access)
    # Use find -printf with pipe-delimited format: name|type|size|mtime
    result = subprocess.run(
        ["sudo", "bash", "-c", f"find {shlex.quote(str(p))} -maxdepth 1 -mindepth 1 -printf '%f|%Y|%s|%T@\\n' 2>/dev/null"],
        capture_output=True, text=True, timeout=15
    )
    items = []
    seen = set()
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) < 4:
            continue
        name = parts[0]
        if name in seen or not name:
            continue
        seen.add(name)
        type_char = parts[1].strip()
        size_str = parts[2].strip()
        mtime_str = parts[3].strip()
        is_dir = type_char == "d"
        try:
            size = int(size_str)
        except ValueError:
            size = 0
        modified = ""
        if mtime_str:
            try:
                ts = float(mtime_str)
                modified = datetime.fromtimestamp(ts).isoformat()
            except ValueError:
                pass
        items.append({"name": name, "is_dir": is_dir, "size": size, "modified": modified})
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"items": items, "path": str(p)}

@app.post("/api/v1/files/mkdir")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_mkdir", "20/minute"))
async def create_folder(request: Request, body: FileAction, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if _sudo_exists(str(p)):
        raise HTTPException(status_code=400, detail="Path already exists")
    result = subprocess.run(["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(p))}"], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {result.stderr}")
    return {"status": "ok"}

@app.post("/api/v1/files/upload")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_upload", "10/minute"))
async def upload_file(request: Request, file: UploadFile = File(...), path: str = Form(...), user = Depends(get_current_user)):
    target_dir = Path(safe_path(path, user))
    if not _sudo_exists(str(target_dir), "-d"):
        raise HTTPException(status_code=404, detail="Target directory not found")
    # Pre-check Content-Length header before reading body
    cl = request.headers.get("content-length")
    if cl and int(cl) > _max_upload_bytes():
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {_max_upload_bytes() // (1024*1024)}MB")
    # Sanitize filename: strip path separators, limit length
    raw_name = (file.filename or "upload").replace("/", "_").replace("\\", "_")[:255]
    if not raw_name:
        raw_name = "upload"
    dest = target_dir / raw_name
    if _sudo_exists(str(dest)):
        base, ext = dest.stem, dest.suffix
        counter = 1
        while _sudo_exists(str(dest)):
            dest = target_dir / f"{base} ({counter}){ext}"
            counter += 1
    # Read with size limit to prevent memory exhaustion (cap read to MAX + 1)
    content = await file.read(_max_upload_bytes() + 1)
    if len(content) > _max_upload_bytes():
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {_max_upload_bytes() // (1024*1024)}MB")
    # Use sudo tee to write file (cloudbanana user may not have write permission)
    result = subprocess.run(["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(dest.parent))} && cat > {shlex.quote(str(dest))}"], input=content, capture_output=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to upload file")
    return {"status": "ok", "path": str(dest)}

@app.post("/api/v1/files/read")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_read", "30/minute"))
async def read_file(request: Request, body: FileAction, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=404, detail="File not found")
    content = _sudo_read(str(p))
    return {"content": content, "path": str(p)}

@app.post("/api/v1/files/write")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_write", "30/minute"))
async def write_file(request: Request, body: WriteFileBody, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    import shlex
    result = subprocess.run(
        ["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(p.parent))} && cat > {shlex.quote(str(p))}"],
        input=body.content, capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to write file")
    return {"status": "ok"}

@app.post("/api/v1/files/remove")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_remove", "30/minute"))
async def remove_file(request: Request, body: FileAction, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not _sudo_exists(str(p)):
        raise HTTPException(status_code=404, detail="Path not found")
    # Use centralized trash directory (writable by cloudbanana service user)
    INSTALL_DIR = Path("/etc/cloudbanana")
    trash_dir = INSTALL_DIR / "trash" / user.username
    if str(p) != str(trash_dir) and str(p).startswith(str(trash_dir)):
        # Already in trash — permanently delete (use sudo bash -c)
        try:
            result = subprocess.run(["sudo", "bash", "-c", f"rm -rf {shlex.quote(str(p))}"], capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                raise HTTPException(status_code=403, detail="Permission denied: cannot permanently delete this file")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="Delete timed out")
        return {"status": "ok", "permanent": True}
    # Move to centralized trash (use sudo bash -c since only that is in sudoers)
    subprocess.run(["sudo", "bash", "-c", f"mkdir -p {shlex.quote(str(trash_dir))}"], capture_output=True, timeout=10)
    dest = trash_dir / p.name
    if _sudo_exists(str(dest)):
        stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        dest = trash_dir / f"{p.stem}_{stamp}{p.suffix}"
    try:
        result = subprocess.run(["sudo", "bash", "-c", f"mv {shlex.quote(str(p))} {shlex.quote(str(dest))}"], capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise HTTPException(status_code=403, detail=f"Permission denied: cannot move this file to trash")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Move to trash timed out")
    return {"status": "ok", "trash_path": str(dest)}

@app.get("/api/v1/files/raw")
async def serve_raw_file(path: str, user = Depends(get_current_user)):
    p = safe_path(path, user)
    if not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=404, detail="File not found")
    # Read via sudo cat (cloudbanana user may not have permission to open the file directly)
    data = subprocess.run(["sudo", "bash", "-c", f"cat {shlex.quote(str(p))}"], capture_output=True, timeout=30)
    if data.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to read file")
    media_type, _ = mimetypes.guess_type(str(p))
    return Response(content=data.stdout, media_type=media_type or "application/octet-stream")

@app.post("/api/v1/files/link")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_link", "20/minute"))
async def create_file_link(request: Request, body: FileAction, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=404, detail="File not found")
    with Session(engine) as session:
        link = FileLinkModel(path=str(p))
        session.add(link)
        session.commit()
        session.refresh(link)
    return {"id": link.id, "size": p.stat().st_size}

def _make_fake_user(username: str, role: str):
    """Create a minimal user-like object for safe_path."""
    return type('FakeUser', (), {'username': username, 'role': role})()

@app.api_route("/api/v1/files/serve/{serve_path:path}", methods=["GET", "POST"])
async def serve_file_for_webview(serve_path: str, request: Request, token: str = ""):
    """Serve file for WebView/BWeb iframe.
    Supports GET (static files) and POST (PHP form submissions).
    Auth via Authorization header, cookie, or query param token.
    PHP files are executed through PHP CLI for correct output.
    """
    # Try auth: Authorization header > cookie > query param token
    auth_token = ""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        auth_token = auth[7:]
    if not auth_token:
        auth_token = request.cookies.get("token", "")
    if not auth_token:
        auth_token = token
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Decode token to get user
    from jose import jwt as jose_jwt
    from app.auth import _SECRET_KEY, ALGORITHM
    try:
        payload = jose_jwt.decode(auth_token, _SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub", "")
        role = payload.get("role", "user")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    fake_user = _make_fake_user(username, role)
    p = safe_path("/" + serve_path, fake_user) if not serve_path.startswith("/") else safe_path(serve_path, fake_user)
    if not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=404, detail="File not found")

    # ---- PHP file execution via CLI ----
    if p.suffix.lower() == ".php":
        # Build env vars for PHP CLI
        script_name = f"/api/v1/files/serve/{serve_path}"
        query_string = request.url.query
        request_method = request.method
        content_type = request.headers.get("content-type", "")
        body_bytes = b""
        if request.method == "POST":
            body_bytes = await request.body()
        host = request.headers.get("host", "localhost")
        remote_addr = request.client.host if request.client else "127.0.0.1"
        # Use sudo bash -c with inline env vars (sudo env requires password, bash -c is allowed)
        php_file = shlex.quote(str(p))
        env_str = " ".join(
            f"{k}={shlex.quote(str(v))}"
            for k, v in (
                ("REQUEST_METHOD", request_method),
                ("QUERY_STRING", query_string),
                ("SCRIPT_NAME", script_name),
                ("SCRIPT_FILENAME", str(p)),
                ("REQUEST_URI", f"{script_name}?{query_string}" if query_string else script_name),
                ("SERVER_NAME", host),
                ("SERVER_PORT", "8888"),
                ("HTTP_HOST", host),
                ("REMOTE_ADDR", remote_addr),
                ("CONTENT_TYPE", content_type),
                ("CONTENT_LENGTH", str(len(body_bytes))),
            )
        )
        shell_cmd = f"{env_str} php -f {php_file}"
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["sudo", "bash", "-c", shell_cmd],
                input=body_bytes if request.method == "POST" else None,
                capture_output=True,
                timeout=30,
            )
            if result.returncode != 0 and not result.stdout:
                err_msg = result.stderr.decode("utf-8", errors="replace").strip()[:500]
                logger.warning(f"PHP execution failed for {p}: {err_msg}")
                # Fall back to serving raw PHP source
                data = subprocess.run(
                    ["sudo", "bash", "-c", f"cat {shlex.quote(str(p))}"],
                    capture_output=True, timeout=15
                )
                if data.returncode == 0:
                    media_type, _ = mimetypes.guess_type(str(p))
                    return Response(content=data.stdout, media_type=media_type or "application/octet-stream")
                raise HTTPException(status_code=500, detail=f"PHP error: {err_msg}")
            output = result.stdout.decode("utf-8", errors="replace")
            # Detect content type: if output starts with <?, PHP didn't execute
            media_type = "text/html; charset=utf-8"
            if output.strip().startswith("<?"):
                media_type = "text/plain; charset=utf-8"
            return Response(content=output, media_type=media_type)
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="PHP execution timed out")
        except FileNotFoundError:
            # PHP not installed — fall back to serving raw source
            logger.warning("PHP not found on system, serving raw file")
            data = subprocess.run(
                ["sudo", "bash", "-c", f"cat {shlex.quote(str(p))}"],
                capture_output=True, timeout=15
            )
            if data.returncode != 0:
                raise HTTPException(status_code=500, detail="Failed to read file")
            media_type, _ = mimetypes.guess_type(str(p))
            return Response(content=data.stdout, media_type=media_type or "application/octet-stream")

    # ---- Non-PHP files: serve raw content ----
    data = subprocess.run(
        ["sudo", "bash", "-c", f"cat {shlex.quote(str(p))}"],
        capture_output=True, timeout=30
    )
    if data.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to read file")
    media_type, _ = mimetypes.guess_type(str(p))
    return Response(content=data.stdout, media_type=media_type or "application/octet-stream")

@app.get("/api/v1/files/raw/{file_id}")
async def serve_raw_by_link(file_id: str, user = Depends(get_current_user)):
    with Session(engine) as session:
        link = session.get(FileLinkModel, file_id)
        if not link:
            raise HTTPException(status_code=404, detail="Link not found or expired")
        p = Path(link.path)
        if not _sudo_exists(str(p), "-f"):
            raise HTTPException(status_code=404, detail="File not found")
    data = subprocess.run(["sudo", "bash", "-c", f"cat {shlex.quote(str(p))}"], capture_output=True, timeout=30)
    if data.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to read file")
    media_type, _ = mimetypes.guess_type(str(p))
    return Response(content=data.stdout, media_type=media_type or "application/octet-stream")

@app.patch("/api/v1/files/link/{file_id}")
async def update_file_link(file_id: str, body: FileAction, user = Depends(get_current_user)):
    with Session(engine) as session:
        link = session.get(FileLinkModel, file_id)
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")
        p = safe_path(body.path, user)
        link.path = str(p)
        session.add(link)
        session.commit()
    return {"status": "ok"}

@app.post("/api/v1/files/rename")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_rename", "20/minute"))
async def rename_file(request: Request, body: RenameBody, user = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not _sudo_exists(str(p)):
        raise HTTPException(status_code=404, detail="Path not found")
    new_p = p.parent / body.new_name
    result = subprocess.run(["sudo", "bash", "-c", f"mv {shlex.quote(str(p))} {shlex.quote(str(new_p))}"], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to rename")
    return {"status": "ok"}

@app.post("/api/v1/files/copy")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_copy", "20/minute"))
async def copy_file(request: Request, body: CopyMoveBody, user = Depends(get_current_user)):
    src = safe_path(body.path, user)
    dst = safe_path(body.dest, user)
    if not _sudo_exists(str(src)):
        raise HTTPException(status_code=404, detail="Source not found")
    if _sudo_exists(str(dst)):
        raise HTTPException(status_code=400, detail="Destination already exists")
    if _sudo_exists(str(src), "-d"):
        result = subprocess.run(["sudo", "bash", "-c", f"cp -r {shlex.quote(str(src))} {shlex.quote(str(dst))}"], capture_output=True, text=True, timeout=30)
    else:
        result = subprocess.run(["sudo", "bash", "-c", f"cp {shlex.quote(str(src))} {shlex.quote(str(dst))}"], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to copy")
    return {"status": "ok"}

@app.post("/api/v1/files/move")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_move", "20/minute"))
async def move_file(request: Request, body: CopyMoveBody, user = Depends(get_current_user)):
    src = safe_path(body.path, user)
    dst = safe_path(body.dest, user)
    if not _sudo_exists(str(src)):
        raise HTTPException(status_code=404, detail="Source not found")
    if _sudo_exists(str(dst)):
        raise HTTPException(status_code=400, detail="Destination already exists")
    result = subprocess.run(["sudo", "bash", "-c", f"mv {shlex.quote(str(src))} {shlex.quote(str(dst))}"], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Failed to move")
    return {"status": "ok"}

def _safe_extract(zf: zipfile.ZipFile, dest: Path):
    """Extract ZIP safely — prevents Zip Slip (path traversal in member names)."""
    for member in zf.namelist():
        member_path = Path(member)
        resolved = (dest / member_path).resolve()
        if not str(resolved).startswith(str(dest.resolve())):
            raise ValueError(f"Zip slip detected: {member}")
    zf.extractall(dest)

# ========== Compress / Extract API ==========

class CompressMultiBody(BaseModel):
    paths: list[str]

def _do_compress(src: Path, dest: Path):
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
        if src.is_dir():
            for file in src.rglob('*'):
                if file.is_file() or file.is_dir():
                    try:
                        zf.write(file, file.relative_to(src.parent))
                    except FileNotFoundError:
                        pass
        else:
            zf.write(src, src.name)

@app.post("/api/v1/files/compress")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_compress", "10/minute"))
async def compress_file(request: Request, body: FileAction, user = Depends(get_current_user)):
    src = safe_path(body.path, user)
    if not _sudo_exists(str(src)):
        raise HTTPException(status_code=404, detail="Path not found")
    if src.is_file() and src.suffix == '.zip':
        raise HTTPException(status_code=400, detail="File is already a ZIP archive")
    dest = src.parent / (src.name + '.zip')
    counter = 1
    while dest.exists():
        dest = src.parent / f"{src.name} ({counter}).zip"
        counter += 1
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _do_compress, src, dest)
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=400, detail=f"Compression failed: {str(e)}")
    return {"status": "ok", "path": str(dest)}

@app.post("/api/v1/files/compress-multi")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_compress", "10/minute"))
async def compress_multi(request: Request, body: CompressMultiBody, user = Depends(get_current_user)):
    paths = [safe_path(p, user) for p in body.paths]
    for p in paths:
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {p}")
    common_parent = paths[0].parent
    dest = common_parent / 'archive.zip'
    counter = 1
    while dest.exists():
        dest = common_parent / f"archive ({counter}).zip"
        counter += 1
    def _do_compress_multi():
        with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
            for src in paths:
                if src.is_dir():
                    for file in src.rglob('*'):
                        if file.is_file() or file.is_dir():
                            try:
                                zf.write(file, file.relative_to(common_parent))
                            except FileNotFoundError:
                                pass
                else:
                    zf.write(src, src.relative_to(common_parent))
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _do_compress_multi)
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=400, detail=f"Compression failed: {str(e)}")
    return {"status": "ok", "path": str(dest)}

@app.post("/api/v1/files/extract")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_extract", "10/minute"))
async def extract_file(request: Request, body: FileAction, user = Depends(get_current_user)):
    src = safe_path(body.path, user)
    if not _sudo_exists(str(src), "-f"):
        raise HTTPException(status_code=404, detail="File not found")
    if not src.suffix.lower() == '.zip':
        raise HTTPException(status_code=400, detail="Only ZIP files are supported for extraction")
    dest_dir = src.parent
    def _do_extract():
        with zipfile.ZipFile(src, 'r') as zf:
            _safe_extract(zf, dest_dir)
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _do_extract)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction failed: {str(e)}")
    return {"status": "ok", "path": str(dest_dir)}

# ========== Trash API ==========

@app.post("/api/v1/trash/empty")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_trash_empty", "10/minute"))
async def empty_trash(request: Request, user: User = Depends(get_current_user)):
    INSTALL_DIR = Path("/etc/cloudbanana")
    trash_dir = INSTALL_DIR / "trash" / user.username
    if not trash_dir.exists():
        return {"status": "ok", "message": "Trash is already empty"}
    # Use sudo bash -c to empty trash (files may be owned by different users)
    try:
        import shlex
        subprocess.run(["sudo", "bash", "-c", f"find {shlex.quote(str(trash_dir))} -mindepth 1 -delete"], capture_output=True, text=True, timeout=30)
    except Exception:
        logger.warning("Failed to empty trash", exc_info=True)
    return {"status": "ok", "message": "Trash emptied"}

class TrashRestoreBody(BaseModel):
    path: str

@app.post("/api/v1/trash/restore")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_trash_restore", "10/minute"))
async def restore_trash(request: Request, body: TrashRestoreBody, user: User = Depends(get_current_user)):
    src = safe_path(body.path, user)
    if not src.exists():
        raise HTTPException(status_code=404, detail="File not found in trash")
    INSTALL_DIR = Path("/etc/cloudbanana")
    trash_dir = INSTALL_DIR / "trash" / user.username
    # Ensure the file is within the user's centralized trash
    if not str(src).startswith(str(trash_dir)):
        raise HTTPException(status_code=403, detail="Path is not in trash directory")
    # Restore to user's home directory
    home = Path(f"/{user.username}") if user.username == 'root' else Path(f"/home/{user.username}")
    home.mkdir(parents=True, exist_ok=True)
    dest = home / src.name
    counter = 1
    while dest.exists():
        stem = src.stem
        suffix = src.suffix
        dest = home / f"{stem}_{counter}{suffix}"
        counter += 1
    # Use sudo bash -c mv since cloudbanana user may not own the trash file
    try:
        import shlex
        result = subprocess.run(
            ["sudo", "bash", "-c", f"mv {shlex.quote(str(src))} {shlex.quote(str(dest))}"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise HTTPException(status_code=403, detail="Permission denied: cannot restore this file")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Restore timed out")
    return {"status": "ok", "restored_to": str(dest)}

# ========== System Packages (for Software Center) ==========

@app.get("/api/v1/system/packages")
async def list_system_packages(user: User = Depends(get_current_user)):
    try:
        # Single dpkg-query call with Essential field — avoids 1000+ subprocess calls
        result = subprocess.run(
            ["dpkg-query", "-W", "-f", '${Package}\t${Version}\t${Installed-Size}\t${Essential}\n'],
            capture_output=True, text=True, timeout=30
        )
        pkgs = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split('\t')
            if len(parts) >= 4:
                name, ver, size, essential = parts[0], parts[1], parts[2], parts[3]
                removable = essential.strip().lower() != 'yes'
                pkgs.append({
                    "name": name,
                    "version": ver,
                    "size_mb": round(int(size) / 1024, 1),
                    "removable": removable
                })
        return pkgs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list packages: {str(e)}")

class RemovePkgBody(BaseModel):
    package: str

    @field_validator("package")
    @classmethod
    def valid_package(cls, v):
        if not re.match(r'^[a-zA-Z0-9.+_-]+$', v):
            raise ValueError("Invalid package name")
        return v

@app.post("/api/v1/system/packages/remove")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_package_remove", "5/minute"))
async def remove_system_package(request: Request, body: RemovePkgBody, user: User = Depends(get_current_user)):
    try:
        result = subprocess.run(
            ["apt-get", "remove", "-y", body.package],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=result.stderr or "Remove failed")
        return {"status": "success", "message": f"Package {body.package} removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== System Info ==========

@app.get("/api/v1/system/info")
async def get_system_info(user = Depends(get_current_user)):
    import socket
    import psutil
    hostname = socket.gethostname()
    ip = "127.0.0.1"
    ipv6 = ""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    try:
        s6 = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        s6.settimeout(1)
        s6.connect(("2600::", 1))
        ipv6 = s6.getsockname()[0]
        s6.close()
    except Exception:
        ipv6 = ""
    # IP geolocation via ip-api.com
    location = ""
    isp = ""
    org = ""
    try:
        import urllib.request
        loop = asyncio.get_running_loop()
        def _fetch_geo():
            req = urllib.request.Request(
                f"http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp,org",
                headers={"User-Agent": "CloudBanana/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read())
        geo = await loop.run_in_executor(None, _fetch_geo)
        if geo.get("status") == "success":
            parts = []
            if geo.get("city"):
                parts.append(geo["city"])
            if geo.get("regionName"):
                parts.append(geo["regionName"])
            if geo.get("country"):
                parts.append(geo["country"])
            location = ", ".join(parts)
            isp = geo.get("isp", "")
            org = geo.get("org", "")
    except Exception:
        pass
    provider = ""
    for path in ["/sys/class/dmi/id/product_name", "/sys/class/dmi/id/sys_vendor",
                  "/sys/hypervisor/uuid"]:
        try:
            v = Path(path).read_text().strip()
            if v and "standard" not in v.lower():
                provider = v
                break
        except Exception:
            pass
    boot = psutil.boot_time()
    uptime = int(time.time() - boot)
    mem = psutil.virtual_memory()
    cpu_freq_obj = psutil.cpu_freq()
    load_1, load_5, load_15 = psutil.getloadavg()
    net = psutil.net_io_counters()
    disk = psutil.disk_usage('/')
    try:
        cpu_model_name = Path("/proc/cpuinfo").read_text()
        for line in cpu_model_name.splitlines():
            if line.startswith("model name"):
                cpu_model_name = line.split(":")[1].strip()
                break
        else:
            cpu_model_name = ""
    except Exception:
        cpu_model_name = ""
    try:
        os_release = Path("/etc/os-release").read_text()
        os_name = ""
        for line in os_release.splitlines():
            if line.startswith("PRETTY_NAME="):
                os_name = line.split("=", 1)[1].strip().strip('"')
        if not os_name:
            os_name = f"{os.uname().sysname} {os.uname().release}"
    except Exception:
        os_name = f"{os.uname().sysname} {os.uname().release}"
    return {
        "version": "0.1.0",
        "hostname": hostname,
        "ip_address": ip,
        "ipv6": ipv6,
        "provider": provider,
        "location": location,
        "isp": isp,
        "org": org,
        "os": os_name,
        "kernel": os.uname().release,
        "architecture": os.uname().machine,
        "cpu": f"{psutil.cpu_count()} vCores ({psutil.cpu_count(logical=False)} physical)",
        "cpu_model": cpu_model_name,
        "cpu_freq": f"{cpu_freq_obj.current:.0f} MHz" if cpu_freq_obj else "",
        "load_1m": round(load_1, 2),
        "load_5m": round(load_5, 2),
        "load_15m": round(load_15, 2),
        "total_ram_mb": round(mem.total / (1024 * 1024)),
        "ram_used_mb": round(mem.used / (1024 * 1024)),
        "ram_percent": mem.percent,
        "swap_total_mb": round(psutil.swap_memory().total / (1024 * 1024)),
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_percent": disk.percent,
        "net_bytes_sent_gb": round(net.bytes_sent / (1024**3), 2),
        "net_bytes_recv_gb": round(net.bytes_recv / (1024**3), 2),
        "uptime_seconds": uptime,
        "processes": len(psutil.pids()),
    }

# ========== PHP Editor ==========

@app.get("/api/v1/php/versions")
async def list_php_versions(user: User = Depends(get_current_user)):
    php_dir = Path("/etc/php")
    versions = []
    if php_dir.exists():
        for ver_dir in sorted(php_dir.iterdir()):
            if not ver_dir.is_dir():
                continue
            version = ver_dir.name
            sasis = []
            for sapi_dir in sorted(ver_dir.iterdir()):
                if not sapi_dir.is_dir():
                    continue
                sapi_name = sapi_dir.name
                # Skip non-SAPI directories
                if sapi_name in ("mods-available", "mods-enabled"):
                    continue
                ini_path = sapi_dir / "php.ini"
                conf_d = sapi_dir / "conf.d"
                files = []
                if ini_path.exists():
                    files.append({"name": "php.ini", "path": str(ini_path), "type": "main"})
                if conf_d.exists():
                    for f in sorted(conf_d.iterdir()):
                        if f.is_file() and f.suffix == ".ini":
                            files.append({"name": f.name, "path": str(f), "type": "extra"})
                if files:
                    sasis.append({"name": sapi_name, "files": files})
            # Check if the PHP binary exists
            binary_path = shutil.which(f"php{version}")
            versions.append({
                "version": version,
                "binary": binary_path or "",
                "sapis": sasis,
            })
    return {"versions": versions}

# ========== Cron Manager ==========

@app.get("/api/v1/cron")
async def get_cron(user: User = Depends(get_current_user)):
    ok, out = run_command(["crontab", "-l"], timeout=5)
    if not ok:
        return {"entries": [], "raw": ""}
    lines = out.strip().split("\n")
    entries = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or line.startswith("#"):
            entries.append({"index": i, "line": line, "type": "comment" if line.startswith("#") else "empty"})
        else:
            entries.append({"index": i, "line": line, "type": "job"})
    return {"entries": entries, "raw": out}

class CronUpdateBody(BaseModel):
    content: str

@app.post("/api/v1/cron")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_cron", "5/minute"))
async def update_cron(request: Request, body: CronUpdateBody, user: User = Depends(get_current_user)):
    try:
        result = subprocess.run(["crontab", "-"], input=body.content, text=True, capture_output=True, timeout=10)
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=result.stderr or "Failed to update crontab")
        return {"status": "ok", "message": "Crontab updated"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Crontab update timed out")

# ========== SSL Manager ==========

@app.get("/api/v1/ssl/certificates")
async def list_ssl_certs(user: User = Depends(get_current_user)):
    certs = []
    # Use sudo to list letsencrypt directories (cloudbanana user may not have access)
    listing = subprocess.run(
        ["sudo", "bash", "-c", f"find /etc/letsencrypt/live -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort"],
        capture_output=True, text=True, timeout=15
    )
    for domain_dir_str in listing.stdout.strip().split("\n"):
        if not domain_dir_str.strip():
            continue
        domain_dir = Path(domain_dir_str)
        cert_path = domain_dir / "fullchain.pem"
        key_path = domain_dir / "privkey.pem"
        cert_exists = subprocess.run(["sudo", "bash", "-c", f"test -f {shlex.quote(str(cert_path))}"], capture_output=True, timeout=5).returncode == 0
        key_exists = subprocess.run(["sudo", "bash", "-c", f"test -f {shlex.quote(str(key_path))}"], capture_output=True, timeout=5).returncode == 0
        info = {"domain": domain_dir.name, "cert_path": str(cert_path) if cert_exists else "", "key_path": str(key_path) if key_exists else "", "source": "letsencrypt"}
        if cert_exists:
            try:
                r = subprocess.run(["sudo", "openssl", "x509", "-in", str(cert_path), "-noout", "-dates", "-subject", "-issuer"], capture_output=True, text=True, timeout=5)
                for line in r.stdout.strip().split("\n"):
                    if "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    info[k.lower()] = v.strip()
            except Exception:
                pass
            try:
                r = subprocess.run(["sudo", "openssl", "x509", "-in", str(cert_path), "-noout", "-enddate"], capture_output=True, text=True, timeout=5)
                if "=" in r.stdout:
                    enddate = r.stdout.split("=", 1)[1].strip()
                    from datetime import datetime
                    try:
                        exp = datetime.strptime(enddate, "%b %d %H:%M:%S %Y %Z")
                        info["expiry"] = exp.isoformat()
                        info["days_left"] = (exp - datetime.utcnow()).days
                    except Exception:
                        pass
            except Exception:
                pass
        certs.append(info)
    return {"certificates": certs}

class CertRequest(BaseModel):
    domain: str
    email: str = ""

@app.get("/api/v1/ssl/domains")
async def get_available_domains(user: User = Depends(get_current_user)):
    domains = set()
    config_dirs = ["/etc/nginx/sites-enabled", "/etc/nginx/conf.d", "/etc/nginx/sites-available"]
    for d in config_dirs:
        # Use sudo find to list files (cloudbanana user may not have access)
        listing = subprocess.run(
            ["sudo", "bash", "-c", f"find {shlex.quote(d)} -maxdepth 1 -type f -o -type l 2>/dev/null"],
            capture_output=True, text=True, timeout=10
        )
        for config_path in listing.stdout.strip().split("\n"):
            if not config_path.strip():
                continue
            try:
                # Read via sudo cat
                text_result = subprocess.run(
                    ["sudo", "bash", "-c", f"cat {shlex.quote(config_path)}"],
                    capture_output=True, text=True, timeout=10
                )
                if text_result.returncode != 0:
                    continue
                text = text_result.stdout
                for m in re.finditer(r'^\s*server_name\s+(.+?);', text, re.MULTILINE):
                    for name in m.group(1).split():
                        name = name.strip().rstrip(';')
                        if name and name != '_':
                            domains.add(name)
            except Exception:
                pass
    return {"domains": sorted(domains)}

@app.get("/api/v1/ssl/check-certbot")
async def check_certbot(user: User = Depends(get_current_user)):
    certbot = shutil.which("certbot")
    if not certbot:
        return {"installed": False, "version": None}
    try:
        r = subprocess.run([certbot, "--version"], capture_output=True, text=True, timeout=5)
        return {"installed": True, "version": r.stdout.strip() or r.stderr.strip()}
    except subprocess.TimeoutExpired:
        logger.warning("Certbot version check timed out")
        return {"installed": True, "version": "unknown"}
    except Exception:
        return {"installed": True, "version": "unknown"}

@app.post("/api/v1/ssl/install-certbot")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_certbot_install", "3/hour"))
async def install_certbot(request: Request, user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["apt-get", "install", "-y", "certbot"], capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            raise HTTPException(status_code=500, detail=r.stderr or "Failed to install certbot")
        return {"status": "ok", "message": "Certbot installed successfully"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Installation timed out")

@app.post("/api/v1/ssl/certificate")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_cert_request", "5/hour"))
async def request_cert(request: Request, body: CertRequest, user: User = Depends(get_current_user)):
    certbot = shutil.which("certbot")
    if not certbot:
        raise HTTPException(status_code=400, detail="Certbot is not installed")
    email_flag = []
    if body.email:
        email_flag = ["--email", body.email]
    # Stop nginx so standalone mode can bind port 80
    subprocess.run(["sudo", "systemctl", "stop", "nginx"], capture_output=True, timeout=15)
    try:
        # Use sudo bash -c for certbot (sudoers only allows bash -c for arbitrary commands)
        certbot_cmd = f"{shlex.quote(certbot)} certonly --standalone --non-interactive --agree-tos -d {shlex.quote(body.domain)} {' '.join(shlex.quote(a) for a in email_flag)}"
        r = subprocess.run(["sudo", "bash", "-c", certbot_cmd], capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            detail = r.stderr or r.stdout or "Certbot failed"
            return {"status": "error", "message": detail.strip()}
        return {"status": "ok", "message": f"Certificate issued for {body.domain}"}
    except subprocess.TimeoutExpired:
        logger.warning(f"Certificate request timed out for {body.domain}")
        return {"status": "error", "message": "Certificate request timed out"}
    except Exception:
        logger.exception(f"Unexpected error requesting certificate for {body.domain}")
        return {"status": "error", "message": "Certificate request failed unexpectedly"}
    finally:
        subprocess.run(["sudo", "systemctl", "start", "nginx"], capture_output=True, timeout=15)

# ========== PM2 Manager ==========

@app.get("/api/v1/pm2/processes")
async def pm2_list(user: User = Depends(get_current_user)):
    ok, out = run_command(["pm2", "jlist"], timeout=10)
    if not ok:
        return {"processes": [], "error": out}
    try:
        procs = json.loads(out)
        return {"processes": [{
            "name": p.get("name", ""),
            "pid": p.get("pid"),
            "status": p.get("pm2_env", {}).get("status", "unknown"),
            "cpu": p.get("monit", {}).get("cpu", 0),
            "memory": p.get("monit", {}).get("memory", 0),
            "uptime": p.get("pm2_env", {}).get("pm_uptime", 0),
            "restarts": p.get("pm2_env", {}).get("restart_time", 0),
            "exec_mode": p.get("pm2_env", {}).get("exec_mode", ""),
            "instances": p.get("pm2_env", {}).get("instances", 1),
        } for p in procs]}
    except json.JSONDecodeError:
        return {"processes": [], "error": "Failed to parse PM2 output"}

class Pm2ActionBody(BaseModel):
    name: str
    action: str  # start, stop, restart, delete

@app.post("/api/v1/pm2/action")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_pm2_action", "10/minute"))
async def pm2_action(request: Request, body: Pm2ActionBody, user: User = Depends(get_current_user)):
    if body.action not in ("start", "stop", "restart", "delete"):
        raise HTTPException(status_code=400, detail="Invalid action")
    ok, out = run_command(["pm2", body.action, body.name], timeout=15)
    if not ok:
        raise HTTPException(status_code=400, detail=out or f"Failed to {body.action} {body.name}")
    return {"status": "ok", "message": f"{body.action.capitalize()}ed {body.name}"}

# ========== Host Editor ==========

@app.get("/api/v1/hosts")
async def read_hosts(user: User = Depends(get_current_user)):
    try:
        content = Path("/etc/hosts").read_text()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class HostsBody(BaseModel):
    content: str

@app.post("/api/v1/hosts")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_hosts", "5/minute"))
async def write_hosts(request: Request, body: HostsBody, user: User = Depends(get_current_user)):
    try:
        Path("/etc/hosts").write_text(body.content)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== Database Editor (MySQL/PostgreSQL) ==========

@app.get("/api/v1/databases/servers")
async def list_db_servers(user: User = Depends(get_current_user)):
    servers = []
    # Check MySQL
    mysql_bin = shutil.which("mysql")
    if mysql_bin:
        ok, out = run_command(["mysql", "-e", "SHOW DATABASES", "-B", "-N"], timeout=5)
        dbs = [db.strip() for db in out.strip().split("\n") if db.strip()] if ok else []
        servers.append({"type": "mysql", "binary": mysql_bin, "available": ok, "databases": dbs})
    # Check PostgreSQL
    psql_bin = shutil.which("psql")
    if psql_bin:
        ok, out = run_command(["psql", "-l", "-t", "-A"], timeout=5)
        dbs = []
        if ok:
            for line in out.strip().split("\n"):
                parts = line.split("|")
                if parts and parts[0].strip():
                    dbs.append(parts[0].strip())
        servers.append({"type": "postgresql", "binary": psql_bin, "available": ok, "databases": dbs})
    if not servers:
        servers.append({"type": "mysql", "binary": "", "available": False, "databases": []})
        servers.append({"type": "postgresql", "binary": "", "available": False, "databases": []})
    return {"servers": servers}

class DbQueryBody(BaseModel):
    type: str  # mysql or postgresql
    database: str
    query: str

@app.post("/api/v1/databases/query")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_db_query", "10/minute"))
async def db_query(request: Request, body: DbQueryBody, user: User = Depends(get_current_user)):
    if not re.match(r'^[a-zA-Z0-9_]+$', body.database):
        raise HTTPException(status_code=400, detail="Invalid database name")
    if body.type == "mysql":
        cmd = ["mysql", "-D", body.database, "-e", body.query, "-B"]
    elif body.type == "postgresql":
        cmd = ["psql", "-d", body.database, "-c", body.query, "-t", "-A", "--csv"]
    else:
        raise HTTPException(status_code=400, detail="Unsupported database type")
    ok, out = run_command(cmd, timeout=15)
    if not ok:
        raise HTTPException(status_code=400, detail=out or "Query failed")
    lines = out.strip().split("\n")
    columns = []
    rows = []
    if lines:
        if body.type == "mysql":
            columns = lines[0].split("\t") if len(lines) > 0 else []
            rows = [line.split("\t") for line in lines[1:]]
        else:
            columns = lines[0].split(",") if len(lines) > 0 else []
            rows = [line.split(",") for line in lines[1:]]
    return {"columns": columns, "rows": rows}

_SERVER_IP: str | None = None

def _get_server_ip() -> str:
    """Get the actual VPS public IP address (cached after first call)."""
    global _SERVER_IP
    if _SERVER_IP:
        return _SERVER_IP
    ip = "127.0.0.1"
    try:
        r = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5)
        parts = r.stdout.strip().split()
        if parts and parts[0] != "127.0.0.1":
            ip = parts[0]
    except Exception:
        pass
    if ip == "127.0.0.1":
        try:
            r = subprocess.run(["curl", "-s", "https://api.ipify.org"], capture_output=True, text=True, timeout=10)
            ip = r.stdout.strip() or ip
        except Exception:
            pass
    if ip == "127.0.0.1":
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(("10.255.255.255", 1))
            ip = s.getsockname()[0]
            s.close()
        except Exception:
            pass
    _SERVER_IP = ip
    return ip

# ========== Laravel Project Installer ==========

class LaravelProjectBody(BaseModel):
    path: str

class LaravelCloneBody(BaseModel):
    repo: str
    branch: str = ""
    path: str

class LaravelEnvBody(BaseModel):
    path: str
    content: str

@app.get("/api/v1/laravel/check-composer")
async def laravel_check_composer(user: User = Depends(get_current_user)):
    composer = shutil.which("composer") or shutil.which("composer.phar")
    if not composer:
        return {"installed": False, "version": None}
    try:
        r = subprocess.run([composer, "--version"], capture_output=True, text=True, timeout=10)
        return {"installed": True, "version": r.stdout.strip() or r.stderr.strip()}
    except Exception:
        return {"installed": True, "version": "unknown"}

LARAVEL_PHP_EXTENSIONS = [
    "cli", "common", "mbstring", "xml",
    "curl", "bcmath", "gd", "zip",
    "mysql", "pgsql", "sqlite3",
]

LARAVEL_PHP_REQUIRED_MODULES = {
    "mbstring", "xml", "curl", "bcmath", "gd", "zip",
    "mysql", "pgsql", "sqlite3", "dom", "simplexml",
}

def _get_php_ver() -> str | None:
    php_bin = shutil.which("php")
    if not php_bin:
        return None
    try:
        r = subprocess.run(["php", "-r", "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;"], capture_output=True, text=True, timeout=5)
        return r.stdout.strip()
    except Exception:
        return None

def _install_php_extensions(php_ver: str):
    # Fix any broken dpkg state first
    subprocess.run(["apt", "--fix-broken", "install", "-y"], capture_output=True, timeout=120)

    prefix = f"php{php_ver}"
    missing = []
    for ext in LARAVEL_PHP_EXTENSIONS:
        pkg = f"{prefix}-{ext}"
        r = subprocess.run(["dpkg", "-l", pkg], capture_output=True, timeout=5)
        if r.returncode != 0 or "ii" not in r.stdout.decode():
            missing.append(pkg)
    if missing:
        subprocess.run(["apt-get", "install", "-y"] + missing, capture_output=True, timeout=120)

    # Verify actual loaded modules, install what's missing
    r = subprocess.run(["php", "-m"], capture_output=True, text=True, timeout=5)
    loaded = set(r.stdout.strip().split("\n"))
    still_missing = LARAVEL_PHP_REQUIRED_MODULES - loaded
    if still_missing:
        alt_pkgs = []
        for mod in still_missing:
            # Map modules to package names
            if mod in ("dom", "simplexml"):
                alt_pkgs.append(f"{prefix}-xml")
            else:
                alt_pkgs.append(f"{prefix}-{mod}")
        if alt_pkgs:
            subprocess.run(["apt-get", "install", "-y"] + list(set(alt_pkgs)), capture_output=True, timeout=120)
        # Enable all still-missing modules
        subprocess.run(["phpenmod", "-v", php_ver] + list(still_missing), capture_output=True, timeout=10)

@app.post("/api/v1/laravel/ensure-php")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_ensure_php", "10/minute"))
async def laravel_ensure_php(request: Request, user: User = Depends(get_current_user)):
    php_ver = _get_php_ver()
    if php_ver:
        # Pastikan semua extension Laravel terinstall
        _install_php_extensions(php_ver)
        return {"installed": True, "version": php_ver, "extensions_installed": True}
    # PHP belum ada — install PHP 8.3 dari PPA ondrej
    subprocess.run(["add-apt-repository", "-y", "ppa:ondrej/php"], capture_output=True, timeout=30)
    subprocess.run(["apt-get", "update", "-qq"], capture_output=True, timeout=60)
    install_pkgs = ["php8.3", "php8.3-cli"] + [f"php8.3-{e}" for e in LARAVEL_PHP_EXTENSIONS]
    subprocess.run(["apt-get", "install", "-y"] + install_pkgs, capture_output=True, timeout=180)
    new_ver = _get_php_ver()
    if not new_ver:
        raise HTTPException(status_code=500, detail="Failed to install PHP")
    return {"installed": True, "version": new_ver, "extensions_installed": True}

@app.post("/api/v1/laravel/install-composer")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_install_composer", "5/hour"))
async def laravel_install_composer(request: Request, user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["apt-get", "install", "-y", "composer"], capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            # Fallback: download composer.phar
            r2 = subprocess.run(["php", "-r", "copy('https://getcomposer.org/installer', 'composer-setup.php');"], capture_output=True, text=True, timeout=30, cwd="/tmp")
            if r2.returncode != 0:
                raise HTTPException(status_code=500, detail=r2.stderr or "Failed to install composer")
            r3 = subprocess.run(["php", "composer-setup.php"], capture_output=True, text=True, timeout=60, cwd="/tmp")
            if r3.returncode != 0:
                raise HTTPException(status_code=500, detail=r3.stderr or "Failed to run composer installer")
            shutil.move("/tmp/composer.phar", "/usr/local/bin/composer")
            subprocess.run(["chmod", "+x", "/usr/local/bin/composer"], capture_output=True, timeout=5)
        return {"status": "ok", "message": "Composer installed"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Installation timed out")

@app.post("/api/v1/laravel/clone")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_clone", "3/hour"))
async def laravel_clone(request: Request, body: LaravelCloneBody, user: User = Depends(get_current_user)):
    target = Path(body.path)
    if target.exists():
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["git", "clone"]
    if body.branch:
        cmd.extend(["--branch", body.branch])
    cmd.extend(["--", body.repo, str(target)])
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            raise HTTPException(status_code=400, detail=r.stderr or "Git clone failed")
        return {"status": "ok", "message": "Repository cloned"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Clone timed out")

@app.post("/api/v1/laravel/upload-zip")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_upload_zip", "5/hour"))
async def laravel_upload_zip(request: Request, file: UploadFile = File(...), path: str = Form(...), user: User = Depends(get_current_user)):
    # Pre-check Content-Length before reading body
    cl = request.headers.get("content-length")
    if cl and int(cl) > _max_upload_bytes():
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {_max_upload_bytes() // (1024*1024)}MB")
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    zip_path = target / "laravel-upload.zip"
    # Read with size limit (cap read to MAX + 1)
    content = await file.read(_max_upload_bytes() + 1)
    if len(content) > _max_upload_bytes():
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {_max_upload_bytes() // (1024*1024)}MB")
    zip_path.write_bytes(content)
    return {"status": "ok", "zip_path": str(zip_path)}

@app.post("/api/v1/laravel/extract")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_extract", "5/hour"))
async def laravel_extract(request: Request, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    target = Path(body.path)
    zip_path = target / "laravel-upload.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=400, detail="No uploaded ZIP found")
    extract_to = target
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            _safe_extract(zf, extract_to)
        # If the zip contains a single root folder, move contents up
        items = list(extract_to.iterdir())
        if len(items) == 1 and items[0].is_dir():
            subdir = items[0]
            for f in subdir.iterdir():
                shutil.move(str(f), str(extract_to / f.name))
            subdir.rmdir()
        zip_path.unlink()
        return {"status": "ok", "message": "Extracted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/laravel/composer-install")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_composer_install", "5/hour"))
async def laravel_composer_install(request: Request, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    composer = shutil.which("composer") or shutil.which("composer.phar")
    if not composer:
        raise HTTPException(status_code=400, detail="Composer not installed")
    # PHP extensions sudah dijamin oleh ensure-php, tapi composer tetap
    # pake --ignore-platform-req agar tahan terhadap project yg butuh ext aneh
    try:
        cmd = [composer, "install", "--no-interaction", "--no-scripts"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=body.path)
        if r.returncode == 0:
            return {"status": "ok", "message": "Dependencies installed", "output": r.stdout[-2000:]}
        # Fallback: coba update dengan ignore platform req + no-scripts
        addLog = (r.stderr or "")[-1000:]
        cmd2 = [composer, "update", "--no-interaction", "--ignore-platform-req=ext-*", "--no-scripts"]
        r2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=600, cwd=body.path)
        if r2.returncode == 0:
            return {"status": "ok", "message": "Dependencies installed (platform reqs ignored)", "output": (addLog + "\n" + r2.stdout[-2000:]).strip()}
        # Jika package terlanjur terinstall, post-script error masih ok
        output = (r.stdout or "")[-2000:]
        stderr = (r.stderr or "")[-1000:]
        if "Installing" in output or "Generating optimized autoload" in output:
            return {"status": "ok", "message": "Dependencies installed (scripts skipped)", "output": (output + "\n" + stderr).strip()}
        raise HTTPException(status_code=400, detail=stderr)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Composer install timed out")

@app.post("/api/v1/laravel/copy-env")
async def laravel_copy_env(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    env_example = Path(body.path) / ".env.example"
    env_file = Path(body.path) / ".env"
    if not env_example.exists():
        raise HTTPException(status_code=400, detail="No .env.example found")
    if env_file.exists():
        return {"status": "ok", "message": ".env already exists", "content": env_file.read_text()}
    env_file.write_text(env_example.read_text())
    return {"status": "ok", "message": ".env created", "content": env_file.read_text()}

@app.put("/api/v1/laravel/save-env")
async def laravel_save_env(body: LaravelEnvBody, user: User = Depends(get_current_user)):
    env_file = Path(body.path) / ".env"
    env_file.write_text(body.content)
    return {"status": "ok", "message": ".env saved"}

@app.post("/api/v1/laravel/storage-link")
async def laravel_storage_link(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["php", "artisan", "storage:link"], capture_output=True, text=True, timeout=30, cwd=body.path)
        if r.returncode != 0:
            raise HTTPException(status_code=400, detail=r.stderr or "storage:link failed")
        return {"status": "ok", "message": "Storage linked"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Command timed out")

@app.post("/api/v1/laravel/app-key")
async def laravel_app_key(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["php", "artisan", "key:generate", "--force"], capture_output=True, text=True, timeout=30, cwd=body.path)
        if r.returncode != 0:
            raise HTTPException(status_code=400, detail=r.stderr or "key:generate failed")
        return {"status": "ok", "message": "App key generated"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Command timed out")

@app.post("/api/v1/laravel/migrate")
async def laravel_migrate(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["php", "artisan", "migrate", "--force"], capture_output=True, text=True, timeout=120, cwd=body.path)
        if r.returncode != 0:
            raise HTTPException(status_code=400, detail=r.stderr or "Migration failed")
        return {"status": "ok", "message": "Database migrated"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Migration timed out")

class LaravelSymlinkBody(BaseModel):
    path: str
    target: str = ""

@app.post("/api/v1/laravel/symlink")
async def laravel_symlink(body: LaravelSymlinkBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists():
        raise HTTPException(status_code=400, detail="Project directory not found")
    public_dir = proj / "public"
    if not public_dir.exists():
        raise HTTPException(status_code=400, detail="public/ directory not found in project")
    link_name = (body.target.strip() or f"/var/www/{proj.name}-www").rstrip('/')
    link_path = Path(link_name)
    if link_path.is_symlink() or link_path.exists():
        if link_path.is_dir() and not link_path.is_symlink():
            shutil.rmtree(link_path)
        else:
            link_path.unlink()
    try:
        link_path.symlink_to(public_dir, target_is_directory=True)
        return {"status": "ok", "message": f"Symlink created: {link_path} → {public_dir}", "link": str(link_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LaravelPermissionsBody(BaseModel):
    path: str

@app.post("/api/v1/laravel/permissions")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_permissions", "10/minute"))
async def laravel_permissions(request: Request, body: LaravelPermissionsBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists():
        raise HTTPException(status_code=400, detail="Project directory not found")
    dirs = [
        proj / "storage",
        proj / "bootstrap" / "cache",
        proj / "database",
    ]
    for d in dirs:
        if d.exists():
            subprocess.run(["chown", "-R", "www-data:www-data", str(d)], capture_output=True, timeout=30)
            subprocess.run(["chmod", "-R", "755", str(d)], capture_output=True, timeout=30)
    # Fix any SQLite database files (in database/ or at project root)
    for pattern in ["database/database.sqlite", "database/*.sqlite", "*.sqlite", proj.name]:
        for f in proj.glob(pattern):
            if f.is_file():
                subprocess.run(["chown", "www-data:www-data", str(f)], capture_output=True, timeout=10)
                subprocess.run(["chmod", "664", str(f)], capture_output=True, timeout=10)
    return {"status": "ok", "message": "Permissions fixed"}

@app.post("/api/v1/laravel/assets-build")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_assets", "5/hour"))
async def laravel_assets_build(request: Request, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists():
        raise HTTPException(status_code=400, detail="Project directory not found")
    pkg = proj / "package.json"
    if not pkg.exists():
        return {"status": "ok", "message": "No package.json — skipped"}
    # Check if build script exists
    try:
        import json
        scripts = json.loads(pkg.read_text()).get("scripts", {})
        if "build" not in scripts:
            return {"status": "ok", "message": "No build script — skipped"}
    except Exception:
        return {"status": "ok", "message": "package.json read error — skipped"}
    # Install node deps + build
    is_yarn = (proj / "yarn.lock").exists()
    try:
        if is_yarn:
            r = subprocess.run(["yarn", "install", "--frozen-lockfile"], capture_output=True, text=True, timeout=120, cwd=proj)
            if r.returncode != 0:
                r = subprocess.run(["yarn", "install"], capture_output=True, text=True, timeout=120, cwd=proj)
            if r.returncode == 0:
                subprocess.run(["yarn", "run", "build"], capture_output=True, text=True, timeout=180, cwd=proj)
        else:
            r = subprocess.run(["npm", "ci", "--ignore-scripts"], capture_output=True, text=True, timeout=120, cwd=proj)
            if r.returncode != 0:
                r = subprocess.run(["npm", "install", "--legacy-peer-deps"], capture_output=True, text=True, timeout=120, cwd=proj)
            if r.returncode == 0:
                subprocess.run(["npm", "run", "build"], capture_output=True, text=True, timeout=180, cwd=proj)
        return {"status": "ok", "message": "Frontend assets built"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Build timed out")

class LaravelVhostBody(BaseModel):
    path: str
    domain: str = ""
    subdomain: str = ""
    with_ssl: bool = False

@app.post("/api/v1/laravel/vhost")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_vhost", "10/minute"))
async def laravel_vhost(request: Request, body: LaravelVhostBody, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists():
        raise HTTPException(status_code=400, detail="Project directory not found")
    public_dir = proj / "public"
    if not public_dir.exists():
        raise HTTPException(status_code=400, detail="public/ directory not found")

    php_ver = _get_php_ver() or "8.3"
    fpm_sock = f"/var/run/php/php{php_ver}-fpm.sock"

    if body.domain and body.subdomain:
        server_name = f"{body.subdomain}.{body.domain}"
        listen_port = 80
    elif body.domain:
        server_name = body.domain
        listen_port = 80
    else:
        server_name = "_"
        port_seed = int(hashlib.md5(str(proj).encode()).hexdigest()[:4], 16)
        listen_port = 8080 + (port_seed % 100)

    config = f"""server {{
    listen {listen_port};
    server_name {server_name};

    root {public_dir};
    index index.php index.html index.htm;

    location / {{
        try_files $uri $uri/ /index.php?$query_string;
    }}

    location ~ \.php$ {{
        fastcgi_pass unix:{fpm_sock};
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }}

    location ~ /\.ht {{
        deny all;
    }}
}}
"""
    config_name = server_name if server_name != "_" else f"{proj.name}-port{listen_port}"
    config_path = Path(f"/etc/nginx/sites-available/{config_name}")
    config_path.write_text(config)
    enabled_path = Path(f"/etc/nginx/sites-enabled/{config_name}")
    if not enabled_path.exists():
        enabled_path.symlink_to(config_path)

    # Open port in firewall for IP-based access
    if server_name == "_":
        subprocess.run(["ufw", "allow", str(listen_port), "comment", f"Laravel {proj.name}"], capture_output=True, timeout=10)

    background_tasks.add_task(lambda: (subprocess.run(["nginx", "-t"], capture_output=True, timeout=10), subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, timeout=15)))

    result = {
        "status": "ok",
        "vhost": config_name,
        "url": f"http://{server_name}" if server_name != "_" else f"http://{_get_server_ip()}:{listen_port}",
        "port": listen_port if server_name == "_" else None,
    }

    if body.domain and body.with_ssl:
        certbot = shutil.which("certbot")
        if certbot:
            background_tasks.add_task(_request_cert_for_domain, server_name)

    return result

def _request_cert_for_domain(domain: str):
    subprocess.run(["sudo", "systemctl", "stop", "nginx"], capture_output=True, timeout=15)
    try:
        # Use sudo bash -c for certbot (sudoers only allows bash -c for arbitrary commands)
        subprocess.run(["sudo", "bash", "-c", f"certbot certonly --standalone --non-interactive --agree-tos -d {shlex.quote(domain)}"], capture_output=True, timeout=120)
    finally:
        subprocess.run(["sudo", "systemctl", "start", "nginx"], capture_output=True, timeout=15)

@app.get("/api/v1/server/ip")
async def get_server_ip(user: User = Depends(get_current_user)):
    try:
        r = subprocess.run(["curl", "-s", "https://api.ipify.org"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            return {"ip": r.stdout.strip()}
    except Exception:
        pass
    try:
        r = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5)
        ip = r.stdout.strip().split()[0] if r.stdout.strip() else "127.0.0.1"
        return {"ip": ip}
    except Exception:
        return {"ip": "127.0.0.1"}

@app.get("/api/v1/laravel/projects")
async def laravel_projects(user: User = Depends(get_current_user)):
    www = Path("/var/www")
    if not www.exists():
        return {"projects": []}
    projects = []
    for child in sorted(www.iterdir()):
        if not child.is_dir() or child.name.startswith('.'):
            continue
        if not (child / "artisan").exists():
            continue
        has_env = (child / ".env").exists()
        link = None
        link_target = f"/var/www/{child.name}-www"
        lt = Path(link_target)
        if lt.is_symlink():
            try:
                link = str(lt.resolve())
            except OSError:
                link = str(lt)
        elif lt.exists():
            link = str(lt) if lt.is_dir() else link_target
        projects.append({
            "name": child.name,
            "path": str(child),
            "has_env": has_env,
            "symlink": link,
        })
    return {"projects": projects}

@app.post("/api/v1/laravel/env-read")
async def laravel_env_read(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    env_file = Path(body.path) / ".env"
    if not env_file.exists():
        raise HTTPException(status_code=400, detail="No .env found")
    return {"content": env_file.read_text()}

@app.post("/api/v1/laravel/final-check")
async def laravel_final_check(body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    checks = {}
    checks["exists"] = proj.exists()
    checks["has_artisan"] = (proj / "artisan").exists()
    checks["has_env"] = (proj / ".env").exists()
    checks["has_vendor"] = (proj / "vendor").exists()
    checks["storage_link"] = (proj / "public" / "storage").exists() or (proj / "public" / "storage" ).is_symlink()
    checks["app_key_set"] = False
    if checks["has_env"]:
        try:
            env_content = (proj / ".env").read_text()
            checks["app_key_set"] = "APP_KEY=" in env_content and "APP_KEY=\n" not in env_content and "APP_KEY= " not in env_content
        except (PermissionError, UnicodeDecodeError):
            checks["app_key_set"] = False
    all_ok = all(checks.values())
    return {"status": "ok" if all_ok else "partial", "checks": checks}

@app.get("/api/v1/laravel/management")
async def laravel_management(user: User = Depends(get_current_user)):
    www = Path("/var/www")
    if not www.exists():
        return {"projects": []}
    projects = []
    _php_version = None
    if shutil.which("php"):
        try:
            r = subprocess.run(["php", "-v"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                m = re.search(r'PHP\s+([\d.]+)', r.stdout.split('\n')[0])
                if m:
                    _php_version = m.group(1)
        except Exception:
            pass

    for child in sorted(www.iterdir()):
        if not child.is_dir() or child.name.startswith('.'):
            continue
        if not (child / "artisan").exists():
            continue
        has_env = (child / ".env").exists()
        has_vendor = (child / "vendor").exists()
        storage_link = (child / "public" / "storage").exists() or (child / "public" / "storage").is_symlink()
        app_key_set = False
        migrated = False
        migration_count = 0
        app_env = None
        app_debug = None
        app_url = None
        db_connection = None
        port = None
        if has_env:
            try:
                env_content = (child / ".env").read_text()
                app_key_set = "APP_KEY=" in env_content and "APP_KEY=\n" not in env_content and "APP_KEY= " not in env_content
                port_seed = int(hashlib.md5(str(child).encode()).hexdigest()[:4], 16)
                port = 8080 + (port_seed % 100)
                for line in env_content.splitlines():
                    line = line.strip()
                    if line.startswith('APP_ENV='):
                        app_env = line.split('=', 1)[1].strip().strip('"\'')
                    elif line.startswith('APP_DEBUG='):
                        app_debug = line.split('=', 1)[1].strip().strip('"\'')
                    elif line.startswith('APP_URL='):
                        app_url = line.split('=', 1)[1].strip().strip('"\'')
                    elif line.startswith('DB_CONNECTION='):
                        db_connection = line.split('=', 1)[1].strip().strip('"\'')
            except (PermissionError, UnicodeDecodeError):
                logger.warning(f"Cannot read .env for {child.name}")
                app_key_set = False
        if has_env and app_key_set:
            if shutil.which("php"):
                try:
                    r = subprocess.run(
                        ["php", "artisan", "migrate:status", "--json"],
                        capture_output=True, text=True, timeout=30, cwd=child
                    )
                    if r.returncode == 0 and r.stdout.strip():
                        try:
                            data = json.loads(r.stdout)
                            if isinstance(data, list):
                                migration_count = sum(1 for m in data if m.get("Ran", ""))
                                migrated = migration_count > 0
                        except (json.JSONDecodeError, TypeError):
                            pass
                except Exception:
                    pass
        # Laravel version from composer.json
        laravel_version = None
        composer_json = child / "composer.json"
        if composer_json.exists():
            try:
                data = json.loads(composer_json.read_text())
                lv = data.get("require", {}).get("laravel/framework", "")
                if lv:
                    laravel_version = lv.lstrip('^~>=<! ')
            except Exception:
                pass
        # Project size
        project_size = None
        try:
            r = subprocess.run(["du", "-sh", "--exclude=vendor", str(child)], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                project_size = r.stdout.strip().split('\t')[0]
        except Exception:
            pass
        url = None
        vhost_available = None
        vhost_enabled = False
        vhost_php_version = None
        for f in Path("/etc/nginx/sites-available").iterdir():
            if f.name == child.name or f.name.startswith(f"{child.name}-port"):
                vhost_available = f
                break
        if vhost_available:
            enabled_path = Path("/etc/nginx/sites-enabled") / vhost_available.name
            vhost_enabled = enabled_path.exists()
            try:
                content = vhost_available.read_text()
                m = re.search(r'listen\s+(\d+)', content)
                sn = re.search(r'server_name\s+(\S+?);', content)
                pv = re.search(r'php([\d.]+)-fpm\.sock', content)
                if pv:
                    vhost_php_version = pv.group(1)
                if sn:
                    name = sn.group(1).strip()
                    if name != "_":
                        url = f"http://{name}"
                if not url and m:
                    url = f"http://{_get_server_ip()}:{m.group(1)}"
            except Exception:
                pass
        projects.append({
            "name": child.name,
            "path": str(child),
            "has_env": has_env,
            "has_vendor": has_vendor,
            "storage_link": storage_link,
            "app_key_set": app_key_set,
            "migrated": migrated,
            "migration_count": migration_count,
            "php_version": _php_version,
            "laravel_version": laravel_version,
            "app_env": app_env,
            "app_debug": app_debug,
            "app_url": app_url,
            "db_connection": db_connection,
            "project_size": project_size,
            "port": port,
            "url": url,
            "vhost_enabled": vhost_enabled,
            "vhost_php_version": vhost_php_version,
        })
    return {"projects": projects}

class LaravelManageAction(BaseModel):
    name: str
    path: str | None = None
    value: str | None = None

class LaravelEnvWriteBody(BaseModel):
    path: str
    content: str

class LaravelManagePhpBody(BaseModel):
    path: str
    php_version: str

class LaravelManageDomainBody(BaseModel):
    path: str
    domain: str = ""
    port: int | None = None

@app.post("/api/v1/laravel/env-write")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_env_write", "10/minute"))
async def laravel_env_write(request: Request, body: LaravelEnvWriteBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    env_file = proj / ".env"
    _sudo_write(env_file, body.content)
    return {"status": "ok"}

@app.get("/api/v1/laravel/php-versions")
async def laravel_php_versions(user: User = Depends(get_current_user)):
    versions = []
    for sock in Path("/var/run/php").glob("php*-fpm.sock"):
        m = re.search(r'php([\d.]+)-fpm', sock.name)
        if m:
            versions.append(m.group(1))
    return {"versions": sorted(versions)}

@app.post("/api/v1/laravel/{name}/migrate")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_migrate", "5/hour"))
async def laravel_migrate(request: Request, name: str, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    if not shutil.which("php"):
        raise HTTPException(status_code=400, detail="PHP not found")
    try:
        r = subprocess.run(
            ["php", "artisan", "migrate", "--force"],
            capture_output=True, text=True, timeout=120, cwd=proj
        )
        return {
            "status": "ok" if r.returncode == 0 else "error",
            "output": r.stdout + r.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": "Command timed out"}
    except Exception as e:
        return {"status": "error", "output": str(e)}

@app.post("/api/v1/laravel/{name}/rollback")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_migrate", "5/hour"))
async def laravel_rollback(request: Request, name: str, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    if not shutil.which("php"):
        raise HTTPException(status_code=400, detail="PHP not found")
    try:
        r = subprocess.run(
            ["php", "artisan", "migrate:rollback", "--force"],
            capture_output=True, text=True, timeout=120, cwd=proj
        )
        return {
            "status": "ok" if r.returncode == 0 else "error",
            "output": r.stdout + r.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": "Command timed out"}
    except Exception as e:
        return {"status": "error", "output": str(e)}

@app.post("/api/v1/laravel/{name}/fresh")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_laravel_migrate", "5/hour"))
async def laravel_fresh(request: Request, name: str, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    if not shutil.which("php"):
        raise HTTPException(status_code=400, detail="PHP not found")
    try:
        r = subprocess.run(
            ["php", "artisan", "migrate:fresh", "--force", "--seed"],
            capture_output=True, text=True, timeout=180, cwd=proj
        )
        return {
            "status": "ok" if r.returncode == 0 else "error",
            "output": r.stdout + r.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": "Command timed out"}
    except Exception as e:
        return {"status": "error", "output": str(e)}

def _find_nginx_vhost(proj_name: str) -> Path | None:
    available = Path("/etc/nginx/sites-available")
    for f in available.iterdir():
        if f.name == proj_name or f.name.startswith(proj_name):
            return f
    return None

def _sudo_write(path: Path, content: str):
    tmp = Path(f"/tmp/opencode_nginx_{path.name}")
    tmp.write_text(content)
    subprocess.run(["sudo", "bash", "-c", f"cp {tmp} {path}"], capture_output=True, timeout=10)
    tmp.unlink(missing_ok=True)

def _sudo_unlink(path: Path):
    subprocess.run(["sudo", "bash", "-c", f"rm -f {path}"], capture_output=True, timeout=10)

def _sudo_symlink(target: Path, link: Path):
    subprocess.run(["sudo", "bash", "-c", f"ln -sf {target} {link}"], capture_output=True, timeout=10)

def _nginx_reload():
    subprocess.run(["sudo", "bash", "-c", "nginx -t"], capture_output=True, timeout=10)
    subprocess.run(["sudo", "bash", "-c", "systemctl reload nginx"], capture_output=True, timeout=15)

@app.post("/api/v1/laravel/{name}/toggle")
async def laravel_toggle(name: str, body: LaravelProjectBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    async with _nginx_lock:
        vhost = _find_nginx_vhost(name)
        if not vhost:
            raise HTTPException(status_code=400, detail="No nginx vhost found for this project")
        enabled = Path("/etc/nginx/sites-enabled") / vhost.name
        is_currently_enabled = enabled.exists()
        if is_currently_enabled:
            _sudo_unlink(enabled)
            status = "disabled"
        else:
            _sudo_symlink(vhost, enabled)
            status = "enabled"
        _nginx_reload()
    return {"status": status}

@app.post("/api/v1/laravel/{name}/php-version")
async def laravel_change_php(name: str, body: LaravelManagePhpBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    php_ver = body.php_version
    sock = Path(f"/var/run/php/php{php_ver}-fpm.sock")
    if not sock.exists():
        raise HTTPException(status_code=400, detail=f"PHP {php_ver} FPM socket not found")
    async with _nginx_lock:
        vhost = _find_nginx_vhost(name)
        if not vhost:
            raise HTTPException(status_code=400, detail="No nginx vhost found")
        content = vhost.read_text()
        new_content = re.sub(
            r'fastcgi_pass unix:/var/run/php/php[\d.]+-fpm\.sock',
            f'fastcgi_pass unix:/var/run/php/php{php_ver}-fpm.sock',
            content
        )
        if new_content == content:
            raise HTTPException(status_code=400, detail=f"PHP version already set to {php_ver}")
        _sudo_write(vhost, new_content)
        _nginx_reload()
    return {"status": "ok", "php_version": php_ver}

@app.post("/api/v1/laravel/{name}/domain")
async def laravel_domain(name: str, body: LaravelManageDomainBody, user: User = Depends(get_current_user)):
    proj = Path(body.path)
    if not proj.exists() or not (proj / "artisan").exists():
        raise HTTPException(status_code=400, detail="Invalid project path")
    async with _nginx_lock:
        vhost = _find_nginx_vhost(name)
        if not vhost:
            raise HTTPException(status_code=400, detail="No nginx vhost found")
        content = vhost.read_text()
        old_listen = re.search(r'listen\s+(\d+)', content)
        old_name = re.search(r'server_name\s+(\S+?);', content)
        listen_port = body.port or (int(old_listen.group(1)) if old_listen else 8080)
        server_name = body.domain if body.domain else (old_name.group(1) if old_name else "_")
        content = re.sub(r'listen\s+\d+', f'listen {listen_port}', content)
        content = re.sub(r'server_name\s+[^;]+;', f'server_name {server_name};', content)
        enabled = Path("/etc/nginx/sites-enabled") / vhost.name
        _sudo_unlink(enabled)
        _sudo_unlink(vhost)
        new_name = server_name if server_name != "_" else f"{name}-port{listen_port}"
        new_vhost = Path("/etc/nginx/sites-available") / new_name
        _sudo_write(new_vhost, content)
        _sudo_symlink(new_vhost, Path("/etc/nginx/sites-enabled") / new_name)
        _nginx_reload()
    return {
        "status": "ok",
        "url": f"http://{server_name}" if server_name != "_" else None,
        "port": listen_port if server_name == "_" else None,
    }

# ========== SQLite Editor ==========

import sqlite3 as sqlite3_module

class SqlQueryBody(BaseModel):
    query: str
    path: str | None = None

def _get_sqlite_path(request_path: str | None = None, user: User | None = None) -> str:
    """Resolve the SQLite database path. Default to app's cloudbanana.db."""
    if request_path:
        p = safe_path(request_path, user)
        if not p.exists() or not p.is_file():
            raise HTTPException(status_code=400, detail="Database file not found")
        return str(p)
    # Default to the app's own database
    db_dir = Path(__file__).resolve().parent.parent
    return str(db_dir / "cloudbanana.db")

def _get_table_info(db_path: str, table: str) -> dict:
    """Get schema info for a single table."""
    conn = sqlite3_module.connect(db_path, timeout=5)
    conn.row_factory = sqlite3_module.Row
    try:
        cursor = conn.execute("PRAGMA table_info(?)", (table,))
        columns = []
        for row in cursor.fetchall():
            columns.append({
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "default": row["dflt_value"],
                "pk": bool(row["pk"]),
            })
        # Row count
        cursor = conn.execute("SELECT COUNT(*) FROM ?", (table,))
        row_count = cursor.fetchone()[0]
        # CREATE statement
        cursor = conn.execute("SELECT sql FROM sqlite_master WHERE type=? AND name=?", ("table", table))
        row = cursor.fetchone()
        create_stmt = row[0] if row else None
        return {"columns": columns, "row_count": row_count, "create_stmt": create_stmt}
    finally:
        conn.close()

@app.get("/api/v1/sql/tables")
async def sql_list_tables(path: str | None = None, user: User = Depends(get_current_user)):
    db_path = _get_sqlite_path(path, user)
    try:
        conn = sqlite3_module.connect(db_path, timeout=5)
        try:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            table_names = [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read database: {str(e)}")
    # Build schemas for all tables
    schemas = {}
    for tbl in table_names:
        try:
            schemas[tbl] = _get_table_info(db_path, tbl)
        except Exception:
            schemas[tbl] = {"columns": [], "row_count": 0, "create_stmt": None}
    return {"tables": table_names, "schemas": schemas}

@app.post("/api/v1/sql/execute")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_sql_execute", "30/minute"))
async def sql_execute(request: Request, body: SqlQueryBody, user: User = Depends(get_current_user)):
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="Query is empty")
    db_path = _get_sqlite_path(body.path, user)
    try:
        conn = sqlite3_module.connect(db_path, timeout=10)
        conn.row_factory = sqlite3_module.Row
        try:
            start = time.time()
            _query_upper = body.query.strip().upper()
            # Only allow SELECT/PRAGMA/EXPLAIN on all databases
            if not _query_upper.startswith(("SELECT", "PRAGMA", "EXPLAIN")):
                raise HTTPException(status_code=403, detail="Only SELECT queries allowed")
            cursor = conn.execute(body.query)
            elapsed = round(time.time() - start, 3)
            is_select = _query_upper.startswith(("SELECT", "PRAGMA", "EXPLAIN"))
            if is_select:
                rows_raw = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                truncated = len(rows_raw) > 500
                if truncated:
                    rows_raw = rows_raw[:500]
                rows_data = [[cell for cell in row] for row in rows_raw]
                return {
                    "columns": columns,
                    "rows": rows_data,
                    "affected": len(rows_raw),
                    "elapsed": elapsed,
                    "truncated": truncated,
                }
            conn.commit()
            affected = cursor.rowcount if cursor.rowcount >= 0 else 0
            return {
                "columns": [],
                "rows": [],
                "affected": affected,
                "elapsed": elapsed,
                "truncated": False,
            }
        except HTTPException:
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"SQL error: {str(e)}")
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL error: {str(e)}")

# ========== Audit Logs ==========

@app.get("/api/v1/audit/logs")
async def get_audit_logs(admin: User = Depends(require_admin)):
    with Session(engine) as session:
        logs = session.exec(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500)
        ).all()
        return [
            {"id": log.id, "action": log.action, "username": log.username,
             "detail": log.detail, "ip_address": log.ip_address,
             "created_at": log.created_at.isoformat() if log.created_at else None}
            for log in logs
        ]

# ========== wget API ==========

_wget_tasks = {}
_wget_tasks_lock = threading.Lock()

class WgetBody(BaseModel):
    url: str
    dir: str = "/root"

@app.post("/api/v1/wget")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_wget", "10/minute"))
async def wget_download(request: Request, body: WgetBody, background_tasks: BackgroundTasks, user = Depends(get_current_user)):
    from urllib.parse import urlparse
    if not re.match(r'^https?://', body.url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    parsed = urlparse(body.url)
    if parsed.hostname and _is_private_host(parsed.hostname):
        raise HTTPException(status_code=403, detail="Cannot download from internal/private hosts")
    home = f"/{user.username}" if user.username == 'root' else f"/home/{user.username}"
    dest_dir = body.dir if body.dir != "/root" else home
    dest_p = Path(dest_dir).resolve()
    if not str(dest_p).startswith(str(Path(home).resolve())):
        raise HTTPException(status_code=403, detail="Download directory must be within your home directory")
    tid = secrets.token_hex(8)
    with _wget_tasks_lock:
        _wget_tasks[tid] = {"url": body.url, "status": "running", "output": "", "_ts": time.time()}
    background_tasks.add_task(_run_wget, tid, body.url, str(dest_p))
    return {"task_id": tid, "status": "running"}

def _run_wget(tid, url, d):
    try:
        result = run_command(["wget", "-P", d, url], timeout=300)
        with _wget_tasks_lock:
            _wget_tasks[tid] = {"url": url, "status": "done", "output": result or "Download completed", "_ts": time.time()}
    except Exception as e:
        with _wget_tasks_lock:
            _wget_tasks[tid] = {"url": url, "status": "error", "output": str(e), "_ts": time.time()}

@app.get("/api/v1/wget/status/{task_id}")
async def wget_status(task_id: str, user = Depends(get_current_user)):
    t = _wget_tasks.get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t

# ========== Terminal (WebSocket PTY) ==========

def _set_winsize(fd, rows, cols):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

@app.websocket("/api/v1/terminal/ws")
async def terminal_ws(ws: WebSocket):
    # Auth check: validate JWT from cookie or query param
    token = ws.cookies.get("token") or ws.query_params.get("token", "")
    if not token:
        await ws.close(code=4001, reason="Authentication required")
        return
    try:
        from jose import jwt as jose_jwt
        from app.auth import _SECRET_KEY, ALGORITHM
        jwt_payload = jose_jwt.decode(token, _SECRET_KEY, algorithms=[ALGORITHM])
        if not jwt_payload.get("sub"):
            await ws.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await ws.close(code=4001, reason="Invalid or expired token")
        return
    await ws.accept()
    master_fd, slave_fd = pty.openpty()
    pid = os.fork()
    if pid == 0:
        os.close(master_fd)
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)
        os.chdir('/home')
        os.environ['TERM'] = 'xterm-256color'
        os.execle('/bin/bash', 'bash', '--login', os.environ)
    os.close(slave_fd)
    _set_winsize(master_fd, 24, 80)

    loop = asyncio.get_event_loop()
    stop_reader = threading.Event()

    def reader():
        while not stop_reader.is_set():
            try:
                data = os.read(master_fd, 4096)
                if not data:
                    break
                asyncio.run_coroutine_threadsafe(ws.send_bytes(data), loop)
            except Exception:
                break

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()

    try:
        while True:
            data = await ws.receive_bytes()
            if data.startswith(b'\x1b[8;'):
                try:
                    parts = data.decode().split(';')
                    rows = int(parts[1])
                    cols = int(parts[2].rstrip('t'))
                    _set_winsize(master_fd, rows, cols)
                except Exception:
                    pass
            else:
                os.write(master_fd, data)
    except Exception:
        pass
    finally:
        stop_reader.set()
        os.close(master_fd)
        os.waitpid(pid, 0)

# ========== BananaBrowser Web Proxy ==========

async def _proxy_auth_user(request: Request, token: str = "") -> User | None:
    """Authenticate user for proxy endpoints.
    Checks: Authorization header > cookie > query param token.
    Also checks JTI blacklist (revoked tokens).
    Returns None if not authenticated.
    """
    from jose import jwt as jose_jwt
    from app.auth import _SECRET_KEY, ALGORITHM
    from app.models import TokenBlacklist
    auth_token = ""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        auth_token = auth[7:]
    if not auth_token:
        auth_token = request.cookies.get("token", "")
    if not auth_token:
        auth_token = token
    if not auth_token:
        return None
    try:
        payload = jose_jwt.decode(auth_token, _SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub", "")
        jti = payload.get("jti", "")
        with Session(engine) as session:
            # Check JTI blacklist
            if jti:
                blacklisted = session.exec(select(TokenBlacklist).where(TokenBlacklist.jti == jti)).first()
                if blacklisted:
                    return None
            user = session.exec(select(User).where(User.username == username)).first()
            return user
    except Exception:
        return None

@app.get("/api/v1/proxy/view/{path:path}")
async def proxy_view(path: str, request: Request, token: str = ""):
    user = await _proxy_auth_user(request, token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    target_url = extract_target_from_view(f"/api/v1/proxy/view/{path}")
    if not target_url:
        raise HTTPException(status_code=400, detail="Invalid proxy URL")
    # Block proxying our own origin (infinite mirror prevention)
    from urllib.parse import urlparse
    parsed = urlparse(target_url)
    if parsed.hostname and _is_private_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Cannot proxy localhost URLs")
    # Also block the configured server IP
    server_host = request.headers.get("host", "").split(":")[0]
    if parsed.hostname and parsed.hostname == server_host:
        raise HTTPException(status_code=400, detail="Cannot proxy the CloudBanana DE server itself")
    return await _proxy_request(request, target_url, auth_token=token)

# ========== Dynamic Settings API ==========

class SettingsUpdateBody(BaseModel):
    settings: dict[str, str]

@app.get("/api/v1/settings")
async def get_settings(user=Depends(get_current_user)):
    """Get all settings from the database."""
    with Session(engine) as session:
        all_settings = session.exec(select(Setting)).all()
        return {s.key: s.value for s in all_settings}

@app.post("/api/v1/settings")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_settings", "10/minute"))
async def update_settings(request: Request, body: SettingsUpdateBody, user=Depends(get_current_user)):
    """Update one or more settings in the database."""
    with Session(engine) as session:
        for key, value in body.settings.items():
            existing = session.get(Setting, key)
            if existing:
                existing.value = value
                session.add(existing)
            else:
                session.add(Setting(key=key, value=value))
        session.commit()
    add_audit_log("settings_updated", user.username, f"Updated {len(body.settings)} settings")
    return {"status": "ok", "updated": list(body.settings.keys())}

@app.get("/api/v1/settings/defaults")
async def get_settings_defaults(user=Depends(get_current_user)):
    """Get default security settings values."""
    return {
        "rate_limit_login": "10/minute",
        "rate_limit_register": "3/hour",
        "rate_limit_change_password": "5/minute",
        "rate_limit_upload": "10/minute",
        "rate_limit_write": "30/minute",
        "rate_limit_remove": "30/minute",
        "rate_limit_mkdir": "20/minute",
        "rate_limit_read": "30/minute",
        "rate_limit_copy": "20/minute",
        "rate_limit_move": "20/minute",
        "rate_limit_rename": "20/minute",
        "rate_limit_compress": "10/minute",
        "rate_limit_extract": "10/minute",
        "rate_limit_trash_empty": "10/minute",
        "rate_limit_trash_restore": "10/minute",
        "rate_limit_subdomain": "10/minute",
        "rate_limit_nginx_test": "10/minute",
        "rate_limit_www_folder": "10/minute",
        "rate_limit_cron": "5/minute",
        "rate_limit_package_remove": "5/minute",
        "rate_limit_certbot_install": "3/hour",
        "rate_limit_cert_request": "5/hour",
        "rate_limit_pm2_action": "10/minute",
        "rate_limit_hosts": "5/minute",
        "rate_limit_db_query": "10/minute",
        "rate_limit_sql_execute": "30/minute",
        "rate_limit_wget": "10/minute",
        "rate_limit_proxy_view": "30/minute",
        "rate_limit_app_install": "5/minute",
        "rate_limit_git_clone": "3/hour",
        "rate_limit_laravel_clone": "3/hour",
        "rate_limit_laravel_migrate": "5/hour",
        "rate_limit_laravel_assets": "5/hour",
        "rate_limit_laravel_env_write": "10/minute",
        "rate_limit_laravel_permissions": "10/minute",
        "max_upload_size_mb": "100",
        "session_timeout_seconds": "3600",
        "lockout_threshold": "5",
        "lockout_duration_minutes": "15",
    }

@app.post("/api/v1/proxy/view/{path:path}")
@limiter.limit(lambda: settings_cache.get_rate("rate_limit_proxy_view", "30/minute"))
async def proxy_view_post(path: str, request: Request, token: str = ""):
    user = await _proxy_auth_user(request, token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    target_url = extract_target_from_view(f"/api/v1/proxy/view/{path}")
    if not target_url:
        raise HTTPException(status_code=400, detail="Invalid proxy URL")
    return await _proxy_request(request, target_url, auth_token=token)

frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"
# Prefer built assets (dist/) over source for production
_built_path = frontend_path / "dist"
if _built_path.exists() and (_built_path / "index.html").exists():
    frontend_path = _built_path

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str, request: Request):
    # Prevent mirror: if this request comes from inside the BananaBrowser proxy,
    # return a plain error page instead of the full CloudBanana DE app.
    referer = request.headers.get("referer", "")
    if "/api/v1/proxy/view/" in referer:
        return Response(
            content="<html><body style='background:#1a1a2e;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><div style='text-align:center'><h2>Page could not be loaded</h2><p style='color:#a0a8c0'>This page cannot be displayed inside BananaBrowser. The link may be broken or requires a regular browser.</p></div></body></html>",
            status_code=200,
            media_type="text/html",
        )
    if not frontend_path.exists():
        raise HTTPException(status_code=404)
    if full_path:
        target = frontend_path / full_path
        if target.is_file():
            return FileResponse(target)
    index = frontend_path / "index.html"
    if index.exists():
        return FileResponse(index, media_type="text/html")
    raise HTTPException(status_code=404)

# ========== DEB Installer API ==========

_apt_fix_lock = asyncio.Lock()

class DebInstallBody(BaseModel):
    path: str

@app.post("/api/v1/deb/info")
@limiter.limit(lambda: "10/minute")
async def deb_package_info(request: Request, body: DebInstallBody, user: User = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not p.name.endswith(".deb") or not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=400, detail="File not found or not a .deb package")
    result = subprocess.run(
        ["sudo", "dpkg-deb", "--show", "--showformat=${Package}|${Version}|${Architecture}|${Description}|${Maintainer}|${Homepage}|${Installed-Size}", shlex.quote(str(p))],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=400, detail=f"Failed to read package info: {result.stderr}")
    parts = result.stdout.strip().split("|", 6)
    return {
        "package": parts[0] if len(parts) > 0 else "",
        "version": parts[1] if len(parts) > 1 else "",
        "architecture": parts[2] if len(parts) > 2 else "",
        "description": parts[3] if len(parts) > 3 else "",
        "maintainer": parts[4] if len(parts) > 4 else "",
        "homepage": parts[5] if len(parts) > 5 else "",
        "installed_size": parts[6] if len(parts) > 6 else "0",
        "filename": p.name,
        "fullpath": str(p),
    }


_DEB_TASKS_DIR = Path("/tmp/deb_tasks")

def _deb_task_write(task_id: str, status: str, output: str):
    task_dir = _DEB_TASKS_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)
    (task_dir / "status").write_text(status)
    (task_dir / "output").write_text(output)

def _deb_task_read(task_id: str) -> dict | None:
    task_dir = _DEB_TASKS_DIR / task_id
    if not task_dir.is_dir():
        return None
    status = (task_dir / "status").read_text() if (task_dir / "status").exists() else "unknown"
    output = (task_dir / "output").read_text() if (task_dir / "output").exists() else ""
    return {"status": status, "output": output}

def _run_deb_install(tid: str, deb_path: str):
    try:
        out = f"Installing {Path(deb_path).name}...\n"
        _deb_task_write(tid, "running", out)
        dpkg = subprocess.run(
            ["sudo", "dpkg", "-i", shlex.quote(deb_path)],
            capture_output=True, text=True, timeout=120
        )
        out += f"dpkg output:\n{dpkg.stdout + dpkg.stderr}\n"
        if dpkg.returncode != 0:
            out += "\nRunning apt-get install -f to fix dependencies...\n"
        else:
            out += "\nRunning apt-get install -f...\n"
        _deb_task_write(tid, "running", out)
        apt = subprocess.run(
            ["sudo", "apt-get", "install", "-y", "-f"],
            capture_output=True, text=True, timeout=180
        )
        out += f"apt-get output:\n{apt.stdout + apt.stderr}\n"
        if dpkg.returncode == 0 and apt.returncode == 0:
            out += "\nInstallation complete!"
            _deb_task_write(tid, "done", out)
        else:
            out += "\nInstallation completed with warnings."
            _deb_task_write(tid, "done", out)
    except subprocess.TimeoutExpired:
        curr = _deb_task_read(tid)
        out = (curr["output"] if curr else "") + "\nError: Installation timed out."
        _deb_task_write(tid, "error", out)
    except Exception as e:
        curr = _deb_task_read(tid)
        out = (curr["output"] if curr else "") + f"\nError: {str(e)}"
        _deb_task_write(tid, "error", out)

@app.post("/api/v1/deb/install")
@limiter.limit(lambda: "3/minute")
async def deb_install(request: Request, background_tasks: BackgroundTasks, body: DebInstallBody, user: User = Depends(get_current_user)):
    p = safe_path(body.path, user)
    if not p.name.endswith(".deb") or not _sudo_exists(str(p), "-f"):
        raise HTTPException(status_code=400, detail="File not found or not a .deb package")
    tid = secrets.token_hex(8)
    _deb_task_write(tid, "running", "Preparing installation...\n")
    background_tasks.add_task(_run_deb_install, tid, str(p))
    return {"task_id": tid, "status": "running"}


@app.get("/api/v1/deb/status/{task_id}")
async def deb_install_status(task_id: str, user: User = Depends(get_current_user)):
    t = _deb_task_read(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": t["status"], "output": t["output"]}


@app.exception_handler(Exception)
async def catch_all_exception_handler(request, exc):
    if isinstance(exc, StarletteHTTPException):
        raise exc
    logger.exception("Unhandled exception")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
