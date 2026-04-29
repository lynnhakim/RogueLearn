"""Thin wrapper around google-genai with structured-output helpers."""
from __future__ import annotations

import json
import os
from typing import Any

from google import genai
from google.genai import types

_client: genai.Client | None = None


def client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.")
        _client = genai.Client(api_key=api_key)
    return _client


def generate_json(
    *,
    model: str,
    prompt: str,
    schema: dict[str, Any],
    system: str | None = None,
    temperature: float = 0.4,
) -> Any:
    """Call Gemini and parse a JSON response that matches the given schema."""
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        system_instruction=system,
    )
    resp = client().models.generate_content(
        model=model,
        contents=prompt,
        config=config,
    )
    text = resp.text or ""
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini returned non-JSON response: {text[:300]}") from e
