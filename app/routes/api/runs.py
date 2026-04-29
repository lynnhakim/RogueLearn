"""JSON run endpoints — start, state, answer, heal, hint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from ... import auth, run_engine
from ...db import get_session
from ...grader import grade_answer, hint_for
from ...models import Attempt, Card, Deck, Run, User
from ...schemas import (
    AnswerIn,
    AttemptOut,
    CardOut,
    EventOut,
    HintIn,
    RunOut,
    RunResultsOut,
    RunStateOut,
)

router = APIRouter(prefix="/api", tags=["runs"])


def _owned_run(s, run_id: int, user: User) -> Run:
    run = s.get(Run, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(404, "Run not found")
    return run


def _run_out(r: Run) -> RunOut:
    return RunOut(
        id=r.id,
        deck_id=r.deck_id,
        starting_hp=r.starting_hp,
        hp=r.hp,
        score=r.score,
        streak=r.streak,
        turn=r.turn,
        status=r.status,
        buffs=run_engine.get_buffs(r),
    )


def _card_out(c: Card) -> CardOut:
    return CardOut(
        id=c.id,
        deck_id=c.deck_id,
        question=c.question,
        answer=c.answer,
        concept=c.concept,
        base_difficulty=c.base_difficulty,
        mastery=c.mastery,
        last_reviewed_at=c.last_reviewed_at,
    )


def _event_out(e: dict) -> EventOut:
    return EventOut(
        correct=e["correct"],
        grade=e["grade"],
        feedback=e["feedback"],
        hp_delta=e["hp_delta"],
        score_delta=e["score_delta"],
        buff_awarded=e["buff_awarded"],
        shield_used=e["shield_used"],
    )


def _attempt_out(a: Attempt) -> AttemptOut:
    return AttemptOut(
        id=a.id,
        card_id=a.card_id,
        user_answer=a.user_answer,
        grade=a.grade,
        correct=a.correct,
        feedback=a.feedback,
        turn=a.turn,
        created_at=a.created_at,
    )


def _attempts_for(s, run_id: int) -> list[Attempt]:
    return s.exec(select(Attempt).where(Attempt.run_id == run_id).order_by(Attempt.turn)).all()


@router.post(
    "/decks/{deck_id}/runs",
    response_model=RunOut,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def start_run(deck_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        deck = s.get(Deck, deck_id)
        if not deck or deck.user_id != user.id:
            raise HTTPException(404, "Deck not found")
        cards = s.exec(select(Card).where(Card.deck_id == deck_id)).all()
        if not cards:
            raise HTTPException(400, "Deck has no cards")
        run = run_engine.start_run(s, deck_id, user.id)
        return _run_out(run)


@router.get("/runs/{run_id}", response_model=RunStateOut | RunResultsOut)
def get_run(run_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        run = _owned_run(s, run_id, user)
        if run.status != "in_progress":
            return RunResultsOut(
                run=_run_out(run),
                attempts=[_attempt_out(a) for a in _attempts_for(s, run.id)],
            )

        seen = run_engine.seen_card_ids_for(s, run)
        card = run_engine.pick_next_card(s, run, seen)
        if card is None:
            run_engine.maybe_finish_if_deck_clear(s, run)
            s.add(run)
            s.commit()
            return RunResultsOut(
                run=_run_out(run),
                attempts=[_attempt_out(a) for a in _attempts_for(s, run.id)],
            )

        return RunStateOut(
            run=_run_out(run),
            card=_card_out(card),
            last_event=None,
            last_card=None,
            hint=None,
        )


@router.post(
    "/runs/{run_id}/answer",
    response_model=RunStateOut | RunResultsOut,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def submit_answer(run_id: int, body: AnswerIn, user: User = Depends(auth.current_user)):
    with get_session() as s:
        run = _owned_run(s, run_id, user)
        card = s.get(Card, body.card_id)
        if not card or run.status != "in_progress":
            raise HTTPException(400, "Bad run/card state")

        lenient = run_engine.consume_buff(run, "focus")
        try:
            result = grade_answer(card.question, card.answer, body.answer, lenient=lenient)
        except Exception as e:
            raise HTTPException(502, f"Grader failed: {type(e).__name__}: {e}")
        event = run_engine.apply_grade(run, card, result)

        s.add(Attempt(
            run_id=run.id,
            card_id=card.id,
            user_answer=body.answer,
            grade=result.grade,
            correct=result.correct,
            feedback=result.feedback,
            turn=run.turn,
        ))
        s.add(run)
        s.add(card)
        s.commit()

        run_engine.maybe_finish_if_deck_clear(s, run)
        s.add(run)
        s.commit()

        if run.status != "in_progress":
            return RunResultsOut(
                run=_run_out(run),
                attempts=[_attempt_out(a) for a in _attempts_for(s, run.id)],
            )

        seen = run_engine.seen_card_ids_for(s, run)
        next_card = run_engine.pick_next_card(s, run, seen)
        if next_card is None:
            run_engine.maybe_finish_if_deck_clear(s, run)
            s.add(run)
            s.commit()
            return RunResultsOut(
                run=_run_out(run),
                attempts=[_attempt_out(a) for a in _attempts_for(s, run.id)],
            )

        return RunStateOut(
            run=_run_out(run),
            card=_card_out(next_card),
            last_event=_event_out(event),
            last_card=_card_out(card),
            hint=None,
        )


@router.post(
    "/runs/{run_id}/heal",
    response_model=RunOut,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def use_heal(run_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        run = _owned_run(s, run_id, user)
        if run.status != "in_progress":
            raise HTTPException(400, "bad run")
        run_engine.use_heal(run)
        s.add(run)
        s.commit()
        return _run_out(run)


@router.post(
    "/runs/{run_id}/hint",
    response_model=RunStateOut,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def use_hint(run_id: int, body: HintIn, user: User = Depends(auth.current_user)):
    with get_session() as s:
        run = _owned_run(s, run_id, user)
        card = s.get(Card, body.card_id)
        if not card or run.status != "in_progress":
            raise HTTPException(400, "bad state")
        if not run_engine.consume_buff(run, "hint"):
            raise HTTPException(400, "no hint buff")
        h = hint_for(card.question, card.answer)
        s.add(run)
        s.commit()
        return RunStateOut(
            run=_run_out(run),
            card=_card_out(card),
            last_event=None,
            last_card=None,
            hint=h,
        )
