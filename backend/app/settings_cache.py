import threading
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models import Setting

logger = logging.getLogger("cloudbanana.settings_cache")

_cache: dict[str, str] = {}
_lock = threading.Lock()

DEFAULTS: dict[str, str] = {
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
    "rate_limit_link": "20/minute",
    "rate_limit_laravel_ensure_php": "10/minute",
    "rate_limit_laravel_install_composer": "5/hour",
    "rate_limit_laravel_upload_zip": "5/hour",
    "rate_limit_laravel_extract": "5/hour",
    "rate_limit_laravel_composer_install": "5/hour",
    "rate_limit_laravel_vhost": "10/minute",
    "rate_limit_settings": "10/minute",
    "max_upload_size_mb": "100",
    "session_timeout_seconds": "3600",
    "lockout_threshold": "5",
    "lockout_duration_minutes": "15",
}

def load():
    with _lock:
        _cache.clear()
        try:
            with Session(engine) as session:
                for s in session.exec(select(Setting)).all():
                    _cache[s.key] = s.value
            logger.info(f"Loaded {len(_cache)} settings from database")
        except Exception as e:
            logger.warning(f"Failed to load settings from DB: {e}")

def get(key: str, default: str = "") -> str:
    return _cache.get(key, default)

def get_int(key: str, default: int = 0) -> int:
    try:
        return int(get(key, str(default)))
    except (ValueError, TypeError):
        return default

def get_rate(key: str, default: str = "10/minute") -> str:
    return get(key, DEFAULTS.get(key, default))
