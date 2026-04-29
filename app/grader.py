"""Free-response grader powered by Gemini."""
from __future__ import annotations

import os
from dataclasses import dataclass

from .llm import generate_json

GRADE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "grade": {"type": "NUMBER"},
        "correct": {"type": "BOOLEAN"},
        "feedback": {"type": "STRING"},
    },
    "required": ["grade", "correct", "feedback"],
}

GRADE_SYSTEM = """You grade short free-response answers against a reference answer.

Output JSON with:
- grade: float in [0, 1] reflecting how much of the reference's substance the user covered.
- correct: true if grade >= 0.7 AND no factually wrong claim was made; otherwise false.
- feedback: ONE short sentence. If correct, affirm specifically. If wrong, point at the missing or incorrect piece — do NOT just restate the answer.

Be lenient on phrasing, casing, synonyms, and order. Be strict on substance: missing a key term or making a wrong claim is wrong. Empty / "i don't know" / "skip" is grade 0, correct false, feedback "no answer given".
"""


@dataclass
class GradeResult:
    grade: float
    correct: bool
    feedback: str


def grade_answer(question: str, reference: str, user_answer: str, lenient: bool = False) -> GradeResult:
    model = os.getenv("GRADER_MODEL", "gemini-2.5-flash")
    extra = "\n\nThe user has a FOCUS buff active: be slightly more lenient on partial credit." if lenient else ""
    prompt = (
        f"Question: {question}\n\n"
        f"Reference answer: {reference}\n\n"
        f"User answer: {user_answer or '(empty)'}\n\n"
        f"Grade now.{extra}"
    )
    raw = generate_json(
        model=model,
        prompt=prompt,
        schema=GRADE_SCHEMA,
        system=GRADE_SYSTEM,
        temperature=0.1,
    )
    return GradeResult(
        grade=float(raw.get("grade", 0.0)),
        correct=bool(raw.get("correct", False)),
        feedback=str(raw.get("feedback", "")).strip(),
    )


def hint_for(question: str, reference: str) -> str:
    """One-line hint that doesn't give away the answer."""
    model = os.getenv("GRADER_MODEL", "gemini-2.5-flash")
    schema = {
        "type": "OBJECT",
        "properties": {"hint": {"type": "STRING"}},
        "required": ["hint"],
    }
    prompt = (
        f"Question: {question}\n"
        f"Reference: {reference}\n"
        "Give ONE short hint (max 12 words) that nudges toward the answer without revealing it."
    )
    raw = generate_json(model=model, prompt=prompt, schema=schema, temperature=0.5)
    return str(raw.get("hint", "")).strip()
