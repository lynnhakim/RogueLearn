"""JSON deck endpoints — list, upload, get, delete card."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlmodel import select

from ... import auth
from ...db import get_session
from ...ingest import extract_cards
from ...models import Attempt, Card, Deck, Run, User
from ...schemas import (
    CardOut,
    DeckCreateOut,
    DeckDetailOut,
    DeckOut,
    DeckSummaryOut,
    RunSummaryOut,
)

router = APIRouter(prefix="/api", tags=["decks"])


def _owned_deck(s, deck_id: int, user: User) -> Deck:
    deck = s.get(Deck, deck_id)
    if not deck or deck.user_id != user.id:
        raise HTTPException(404, "Deck not found")
    return deck


def _deck_out(d: Deck) -> DeckOut:
    return DeckOut(
        id=d.id,
        name=d.name,
        source_filename=d.source_filename,
        created_at=d.created_at,
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


def _run_summary(r: Run) -> RunSummaryOut:
    return RunSummaryOut(
        id=r.id,
        deck_id=r.deck_id,
        started_at=r.started_at,
        ended_at=r.ended_at,
        score=r.score,
        turn=r.turn,
        status=r.status,
    )


@router.get("/decks", response_model=list[DeckSummaryOut])
def list_decks(user: User = Depends(auth.current_user)):
    with get_session() as s:
        decks = s.exec(
            select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at.desc())
        ).all()
        return [
            DeckSummaryOut(
                **_deck_out(d).model_dump(),
                card_count=len(s.exec(select(Card).where(Card.deck_id == d.id)).all()),
            )
            for d in decks
        ]


@router.post(
    "/decks/upload",
    response_model=DeckCreateOut,
    dependencies=[Depends(auth.csrf_protect_header)],
)
async def upload_deck(
    name: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(auth.current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        extracted = extract_cards(file.filename or "notes.txt", content)
    except Exception as e:
        raise HTTPException(502, f"Card extraction failed: {type(e).__name__}: {e}")
    if not extracted:
        raise HTTPException(422, "No cards could be extracted from that file.")

    with get_session() as s:
        deck = Deck(
            user_id=user.id,
            name=name.strip() or (file.filename or "Untitled"),
            source_filename=file.filename,
        )
        s.add(deck)
        s.commit()
        s.refresh(deck)
        for c in extracted:
            s.add(
                Card(
                    deck_id=deck.id,
                    question=c.question,
                    answer=c.answer,
                    concept=c.concept,
                    base_difficulty=max(1.0, min(5.0, c.difficulty)),
                )
            )
        s.commit()
        return DeckCreateOut(deck=_deck_out(deck))


@router.get("/decks/{deck_id}", response_model=DeckDetailOut)
def get_deck(deck_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        deck = _owned_deck(s, deck_id, user)
        cards = s.exec(select(Card).where(Card.deck_id == deck_id)).all()
        runs = s.exec(
            select(Run).where(Run.deck_id == deck_id).order_by(Run.started_at.desc())
        ).all()
        return DeckDetailOut(
            deck=_deck_out(deck),
            cards=[_card_out(c) for c in cards],
            runs=[_run_summary(r) for r in runs[:10]],
        )


@router.delete(
    "/decks/{deck_id}/cards/{card_id}",
    status_code=204,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def delete_card(deck_id: int, card_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        _owned_deck(s, deck_id, user)
        card = s.get(Card, card_id)
        if card and card.deck_id == deck_id:
            s.delete(card)
            s.commit()
    return Response(status_code=204)


@router.delete(
    "/decks/{deck_id}",
    status_code=204,
    dependencies=[Depends(auth.csrf_protect_header)],
)
def delete_deck(deck_id: int, user: User = Depends(auth.current_user)):
    with get_session() as s:
        deck = _owned_deck(s, deck_id, user)
        # No DB-level cascades on these tables — clean up children explicitly.
        run_ids = [r.id for r in s.exec(select(Run).where(Run.deck_id == deck_id)).all()]
        if run_ids:
            for a in s.exec(select(Attempt).where(Attempt.run_id.in_(run_ids))).all():
                s.delete(a)
            for r in s.exec(select(Run).where(Run.deck_id == deck_id)).all():
                s.delete(r)
        for c in s.exec(select(Card).where(Card.deck_id == deck_id)).all():
            s.delete(c)
        s.delete(deck)
        s.commit()
    return Response(status_code=204)
