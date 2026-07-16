import os
import secrets
import hashlib
import re
import logging
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.responses import Response
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import engine
from app.models import User, TokenBlacklist, AuditLog, Lockout
from app import settings_cache

logger = logging.getLogger("cloudbanana.auth")

_SECRET_KEY = os.environ.get("CLOUDBANANA_SECRET_KEY")
if not _SECRET_KEY:
    _KEY_FILE = os.path.join(os.path.dirname(__file__), "..", ".secret_key")
    if os.path.isfile(_KEY_FILE):
        _SECRET_KEY = open(_KEY_FILE).read().strip()
    else:
        _SECRET_KEY = secrets.token_hex(32)
        with open(_KEY_FILE, "w") as f:
            f.write(_SECRET_KEY)
    # Set restrictive permissions on secret key file
    try:
        os.chmod(_KEY_FILE, 0o600)
    except Exception:
        pass

ALGORITHM = "HS256"
_PBKDF2_ITERATIONS = 100000

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

def _lockout_threshold() -> int:
    return settings_cache.get_int("lockout_threshold", 5)

def _lockout_duration_seconds() -> int:
    return settings_cache.get_int("lockout_duration_minutes", 15) * 60

def _session_timeout_minutes() -> int:
    return settings_cache.get_int("session_timeout_seconds", 3600) // 60

security = HTTPBearer(auto_error=False)

# CSRF protection
_CSRF_COOKIE = "csrf_token"

def _is_secure() -> bool:
    """Only set secure flag when explicitly set to HTTPS.
    HTTP is the default (CloudBanana uses HTTP unless a domain is configured)."""
    scheme = os.environ.get("CLOUDBANANA_SCHEME", "").lower()
    if scheme == "https":
        return True
    return False

_SECURE = _is_secure()

def set_auth_cookies(response: Response, token: str):
    """Set httpOnly cookie for JWT and non-httpOnly cookie for CSRF token."""
    csrf_token = secrets.token_hex(16)
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="strict",
        max_age=_session_timeout_minutes() * 60,
        path="/",
        secure=_SECURE,
    )
    response.set_cookie(
        key=_CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        samesite="strict",
        max_age=_session_timeout_minutes() * 60,
        path="/",
        secure=_SECURE,
    )

def clear_auth_cookies(response: Response):
    """Clear auth cookies on logout."""
    response.set_cookie(key="token", value="", httponly=True, samesite="strict", max_age=0, path="/")
    response.set_cookie(key=_CSRF_COOKIE, value="", httponly=False, samesite="strict", max_age=0, path="/")

def validate_csrf(request: Request) -> bool:
    """Validate CSRF token from cookie matches X-CSRF-Token header."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return True
    cookie_token = request.cookies.get(_CSRF_COOKIE, "")
    header_token = request.headers.get("X-CSRF-Token", "")
    if not cookie_token or not header_token:
        return False
    return cookie_token == header_token

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    salt, key = hashed_password.split("$", 1)
    return hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), _PBKDF2_ITERATIONS).hex() == key

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=_session_timeout_minutes()))
    to_encode.update({"exp": expire, "jti": secrets.token_hex(16)})
    return jwt.encode(to_encode, _SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(request: Request = None, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = None
    if credentials is not None:
        token = credentials.credentials
    # Fallback to httpOnly cookie if no Authorization header (e.g. on page reload)
    if not token and request:
        token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        jti: str = payload.get("jti", "")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check if token is blacklisted
    if jti:
        with Session(engine) as session:
            blacklisted = session.exec(select(TokenBlacklist).where(TokenBlacklist.jti == jti)).first()
            if blacklisted:
                raise HTTPException(status_code=401, detail="Token has been revoked")

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user

def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def check_account_locked(username: str) -> bool:
    """Check if an account is currently locked due to failed attempts."""
    with Session(engine) as session:
        entry = session.exec(select(Lockout).where(Lockout.username == username)).first()
        if entry and entry.locked_until:
            if datetime.utcnow() < entry.locked_until:
                return True
            # Lockout expired, reset
            session.delete(entry)
            session.commit()
    return False

def record_failed_attempt(username: str):
    """Record a failed login attempt and lock account if threshold reached."""
    with Session(engine) as session:
        entry = session.exec(select(Lockout).where(Lockout.username == username)).first()
        if not entry:
            entry = Lockout(username=username, failed=0)
            session.add(entry)
        entry.failed += 1
        if entry.failed >= _lockout_threshold():
            entry.locked_until = datetime.utcnow() + timedelta(seconds=_lockout_duration_seconds())
            logger.warning(f"Account locked due to {entry.failed} failed attempts: {username}")
        session.commit()

def reset_lockout(username: str):
    """Reset lockout counter on successful login."""
    with Session(engine) as session:
        entry = session.exec(select(Lockout).where(Lockout.username == username)).first()
        if entry:
            session.delete(entry)
            session.commit()

def revoke_token(jti: str, expires_at: datetime):
    """Add a token JTI to the blacklist."""
    with Session(engine) as session:
        entry = TokenBlacklist(jti=jti, expires_at=expires_at)
        session.add(entry)
        session.commit()

def add_audit_log(action: str, username: str = "", detail: str = "", ip_address: str = ""):
    """Log an audit event to the database."""
    with Session(engine) as session:
        log = AuditLog(action=action, username=username, detail=detail, ip_address=ip_address)
        session.add(log)
        session.commit()

_SPECIAL_CHARS = set("!@#$%^&*(),.?\":{}|<>_\\-+=~`[]\\\\;/'")

def validate_password_strength(password: str) -> Optional[str]:
    """Validate password complexity. Returns error message or None."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number"
    if not any(c in _SPECIAL_CHARS for c in password):
        return "Password must contain at least one special character"
    return None
