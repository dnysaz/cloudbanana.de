from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import OperationalError
import asyncio
from functools import wraps
import time
DATABASE_URL = "sqlite:///./cloudbanana.db"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False}, poolclass=NullPool)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")
    cursor.execute("PRAGMA mmap_size=268435456")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()

def get_session():
    with Session(engine) as session:
        yield session

async def get_session_async():
    loop = asyncio.get_running_loop()
    with Session(engine) as session:
        yield session

def run_db(fn):
    @wraps(fn)
    async def wrapper(*args, **kwargs):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, fn, *args, **kwargs)
    return wrapper

async def run_db_async(func, *args, **kwargs):
    """Run a sync DB function in thread pool - prevents blocking event loop."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, func, *args, **kwargs)


def init_db():
    SQLModel.metadata.create_all(engine)


def db_retry(max_retries=3, delay=0.3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except OperationalError as e:
                    if "database is locked" in str(e) and attempt < max_retries - 1:
                        last_exc = e
                        time.sleep(delay * (attempt + 1))
                        continue
                    raise
            raise last_exc
        return wrapper
    return decorator
