import uuid
from sqlmodel import SQLModel, Field, Column, String
from datetime import datetime
from typing import Optional

class FileLink(SQLModel, table=True):
    id: str = Field(primary_key=True, default_factory=lambda: str(uuid.uuid4()))
    path: str = Field(sa_column=Column(String, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Site(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    domain: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Log(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    action: str
    status: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    action: str
    username: str = ""
    detail: str = ""
    ip_address: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TokenBlacklist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    jti: str = Field(unique=True, index=True)
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Lockout(SQLModel, table=True):
    username: str = Field(primary_key=True)
    failed: int = Field(default=0)
    locked_until: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str
    hashed_password: str
    role: str = Field(default="user")
    name: Optional[str] = Field(default=None)
    avatar: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
