"""Note ingestion: file -> text -> Gemini -> atomic flashcards."""
from __future__ import annotations

import io
import os
from dataclasses import dataclass

from pypdf import PdfReader

from .llm import generate_json

CARD_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "question": {"type": "STRING"},
            "answer": {"type": "STRING"},
            "concept": {"type": "STRING"},
            "difficulty": {"type": "NUMBER"},
        },
        "required": ["question", "answer", "concept", "difficulty"],
    },
}

EXTRACTION_SYSTEM = """You are a study-card extractor. Given a chunk of someone's notes,
produce ATOMIC flashcards that test a single fact, definition, or relationship each.

Rules:
- Each card must stand alone — no "the above", no "as mentioned".
- Question is specific and unambiguous. Answer is concise (1–3 sentences max).
- Concept is a 1-3 word topical tag (e.g. "backpropagation", "TCP handshake", "Krebs cycle").
- Difficulty is 1 (recall a definition) to 5 (multi-step synthesis).
- Skip filler, table-of-contents lines, page headers.
- Aim for 5–15 cards per chunk depending on content density. Skip chunks with no testable content (return []).
"""


@dataclass
class ExtractedCard:
    question: str
    answer: str
    concept: str
    difficulty: float


def read_file(filename: str, content: bytes) -> str:
    """Convert uploaded bytes to plain text."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        return "\n\n".join((p.extract_text() or "") for p in reader.pages)
    # md / txt / anything else: treat as text
    return content.decode("utf-8", errors="replace")


def chunk_text(text: str, target_chars: int = 3500) -> list[str]:
    """Split text into roughly target_chars-sized chunks at paragraph boundaries."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    cur = ""
    for p in paras:
        if len(cur) + len(p) + 2 > target_chars and cur:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


def extract_cards_from_chunk(chunk: str) -> list[ExtractedCard]:
    model = os.getenv("EXTRACTION_MODEL", "gemini-2.5-flash")
    prompt = f"Notes chunk:\n\n{chunk}\n\nReturn the JSON array of cards now."
    raw = generate_json(
        model=model,
        prompt=prompt,
        schema=CARD_SCHEMA,
        system=EXTRACTION_SYSTEM,
        temperature=0.3,
    )
    if not isinstance(raw, list):
        return []
    out: list[ExtractedCard] = []
    for item in raw:
        try:
            out.append(
                ExtractedCard(
                    question=str(item["question"]).strip(),
                    answer=str(item["answer"]).strip(),
                    concept=str(item.get("concept", "")).strip().lower(),
                    difficulty=float(item.get("difficulty", 2.0)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


def extract_cards(filename: str, content: bytes) -> list[ExtractedCard]:
    text = read_file(filename, content)
    cards: list[ExtractedCard] = []
    for chunk in chunk_text(text):
        cards.extend(extract_cards_from_chunk(chunk))
    return cards
