import os
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

from . import models  # noqa: F401  ensures tables register

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./data/roguelearn.db")

# Ensure parent dir exists for sqlite
if DB_URL.startswith("sqlite:///"):
    db_path = DB_URL.removeprefix("sqlite:///")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DB_URL,
    echo=False,
    connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
