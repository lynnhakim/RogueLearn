from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    email_verified_at: Optional[datetime] = None


class AuthSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True, unique=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    csrf_token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    user_agent: Optional[str] = None


class Deck(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    source_filename: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Card(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    deck_id: int = Field(foreign_key="deck.id", index=True)
    question: str
    answer: str
    concept: str = ""
    base_difficulty: float = 2.0  # 1 (easy) – 5 (hard)
    mastery: float = 0.3  # 0–1, updated after each attempt
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Run(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    deck_id: int = Field(foreign_key="deck.id", index=True)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    starting_hp: int = 5
    hp: int = 5
    score: int = 0
    streak: int = 0
    turn: int = 0
    status: str = "in_progress"  # in_progress | won | lost
    buffs_json: str = "[]"
    pending_buff_award: bool = False


class Attempt(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="run.id", index=True)
    card_id: int = Field(foreign_key="card.id", index=True)
    user_answer: str
    grade: float
    correct: bool
    feedback: str
    turn: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
