"""Pydantic request/response schemas for the JSON API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ----- Auth ------------------------------------------------------------------
class SignupIn(BaseModel):
    email: str
    password: str
    password_confirm: str


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime


class AuthOut(BaseModel):
    user: UserOut
    csrf_token: str


# ----- Decks -----------------------------------------------------------------
class DeckOut(BaseModel):
    id: int
    name: str
    source_filename: Optional[str]
    created_at: datetime


class DeckSummaryOut(DeckOut):
    card_count: int


class CardOut(BaseModel):
    id: int
    deck_id: int
    question: str
    answer: str
    concept: str
    base_difficulty: float
    mastery: float
    last_reviewed_at: Optional[datetime]


class RunSummaryOut(BaseModel):
    id: int
    deck_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    score: int
    turn: int
    status: str


class DeckDetailOut(BaseModel):
    deck: DeckOut
    cards: list[CardOut]
    runs: list[RunSummaryOut]


class DeckCreateOut(BaseModel):
    deck: DeckOut


# ----- Runs ------------------------------------------------------------------
class RunOut(BaseModel):
    id: int
    deck_id: int
    starting_hp: int
    hp: int
    score: int
    streak: int
    turn: int
    status: str
    buffs: list[str]


class EventOut(BaseModel):
    correct: bool
    grade: float
    feedback: str
    hp_delta: int
    score_delta: int
    buff_awarded: Optional[str]
    shield_used: bool


class AttemptOut(BaseModel):
    id: int
    card_id: int
    user_answer: str
    grade: float
    correct: bool
    feedback: str
    turn: int
    created_at: datetime


class RunStateOut(BaseModel):
    """Active-run snapshot: current card to answer, last turn's event, optional hint."""
    run: RunOut
    card: Optional[CardOut]
    last_event: Optional[EventOut]
    last_card: Optional[CardOut]
    hint: Optional[str]


class RunResultsOut(BaseModel):
    run: RunOut
    attempts: list[AttemptOut]


class AnswerIn(BaseModel):
    card_id: int
    answer: str = ""


class HintIn(BaseModel):
    card_id: int
