"""Roguelike run mechanics: card selection, HP, buffs, mastery updates."""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, select

from .grader import GradeResult
from .models import Attempt, Card, Run

# --- Tuning ----------------------------------------------------------------
STARTING_HP = 5
MAX_HP = 8
STREAK_BUFF_THRESHOLD = 3   # award a buff every 3 in a row correct
MASTERY_DECAY_HALF_LIFE_DAYS = 7.0
WIN_SCORE = 1500            # cap; mostly we end when deck exhausted

ALL_BUFFS = ["heal", "hint", "shield", "focus"]


# --- Buff helpers ----------------------------------------------------------
def get_buffs(run: Run) -> list[str]:
    try:
        return list(json.loads(run.buffs_json or "[]"))
    except json.JSONDecodeError:
        return []


def set_buffs(run: Run, buffs: list[str]) -> None:
    run.buffs_json = json.dumps(buffs)


def add_buff(run: Run, buff: str) -> None:
    buffs = get_buffs(run)
    buffs.append(buff)
    set_buffs(run, buffs)


def consume_buff(run: Run, buff: str) -> bool:
    buffs = get_buffs(run)
    if buff in buffs:
        buffs.remove(buff)
        set_buffs(run, buffs)
        return True
    return False


# --- Mastery ---------------------------------------------------------------
def decayed_mastery(card: Card, now: datetime) -> float:
    """Mastery, decayed by elapsed time since last review."""
    if card.last_reviewed_at is None:
        return card.mastery
    days = max(0.0, (now - card.last_reviewed_at).total_seconds() / 86400.0)
    factor = math.exp(-days * math.log(2) / MASTERY_DECAY_HALF_LIFE_DAYS)
    return card.mastery * factor


def update_mastery(card: Card, grade: float) -> None:
    """Bayesian-ish update: correct nudges toward 1, wrong drops by half."""
    if grade >= 0.7:
        card.mastery = card.mastery + (1.0 - card.mastery) * (0.3 + 0.4 * grade)
    else:
        card.mastery = card.mastery * (0.4 + 0.4 * grade)
    card.mastery = max(0.0, min(1.0, card.mastery))
    card.last_reviewed_at = datetime.utcnow()


# --- Card selection --------------------------------------------------------
def pick_next_card(
    session: Session,
    run: Run,
    seen_card_ids: set[int],
) -> Optional[Card]:
    """Pick the next card: prefer low-mastery, ramp difficulty with turn number."""
    cards = session.exec(select(Card).where(Card.deck_id == run.deck_id)).all()
    candidates = [c for c in cards if c.id not in seen_card_ids]
    if not candidates:
        return None

    now = datetime.utcnow()
    target_difficulty = 1.0 + min(4.0, run.turn * 0.4)  # turn 0 -> 1.0, turn 10 -> 5.0

    def score(card: Card) -> float:
        # lower mastery = higher priority; closer to target difficulty = higher priority
        m = decayed_mastery(card, now)
        diff_gap = abs(card.base_difficulty - target_difficulty)
        # weighted: mostly mastery, some difficulty match, small jitter
        return (1.0 - m) * 2.0 - diff_gap * 0.3 + random.random() * 0.15

    return max(candidates, key=score)


# --- Damage / scoring ------------------------------------------------------
def apply_grade(run: Run, card: Card, result: GradeResult) -> dict:
    """Apply a grade to the run. Returns event dict for UI."""
    event = {
        "correct": result.correct,
        "grade": result.grade,
        "feedback": result.feedback,
        "hp_delta": 0,
        "score_delta": 0,
        "buff_awarded": None,
        "shield_used": False,
    }

    if result.correct:
        # Score: difficulty * 100 * grade, with streak multiplier
        multiplier = 1.0 + 0.1 * run.streak
        gained = int(card.base_difficulty * 100 * result.grade * multiplier)
        run.score += gained
        run.streak += 1
        event["score_delta"] = gained

        if run.streak > 0 and run.streak % STREAK_BUFF_THRESHOLD == 0:
            buff = random.choice(ALL_BUFFS)
            add_buff(run, buff)
            event["buff_awarded"] = buff
    else:
        run.streak = 0
        if consume_buff(run, "shield"):
            event["shield_used"] = True
        else:
            # damage scales with card difficulty (rounded up to int 1..3)
            dmg = max(1, int(round(card.base_difficulty / 2)))
            run.hp = max(0, run.hp - dmg)
            event["hp_delta"] = -dmg

    update_mastery(card, result.grade)
    run.turn += 1

    if run.hp <= 0:
        run.status = "lost"
        run.ended_at = datetime.utcnow()

    return event


def use_heal(run: Run) -> bool:
    if consume_buff(run, "heal"):
        run.hp = min(MAX_HP, run.hp + 2)
        return True
    return False


def seen_card_ids_for(session: Session, run: Run) -> set[int]:
    rows = session.exec(select(Attempt.card_id).where(Attempt.run_id == run.id)).all()
    return set(rows)


def maybe_finish_if_deck_clear(session: Session, run: Run) -> None:
    """If we've seen every card, mark run won."""
    total = len(session.exec(select(Card).where(Card.deck_id == run.deck_id)).all())
    seen = len(seen_card_ids_for(session, run))
    if seen >= total and run.status == "in_progress":
        run.status = "won"
        run.ended_at = datetime.utcnow()


def start_run(session: Session, deck_id: int, user_id: int) -> Run:
    run = Run(
        deck_id=deck_id,
        user_id=user_id,
        starting_hp=STARTING_HP,
        hp=STARTING_HP,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run
