from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from sqlalchemy.pool import NullPool
import asyncio
from functools import wraps

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

def init_db():
    SQLModel.metadata.create_all(engine)
