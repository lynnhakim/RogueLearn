"""Authentication primitives: passwords, sessions, CSRF, dependencies."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlmodel import Session as DBSession
from sqlmodel import select

from .db import get_session
from .models import AuthSession, User

# argon2id — current OWASP-recommended password hash.
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

SESSION_COOKIE = "roguelearn_session"
SESSION_LIFETIME = timedelta(days=14)
LAST_SEEN_REFRESH_INTERVAL = timedelta(minutes=5)


class LoginRequired(Exception):
    """Raised when an authenticated route is hit without a valid session."""


# ----- Password hashing -------------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False


# ----- Sessions ---------------------------------------------------------------
def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _is_prod() -> bool:
    return os.getenv("ENV", "dev").lower() != "dev"


def _secure_cookie() -> bool:
    return _is_prod()


def _samesite() -> str:
    # Cross-origin SPA in prod (vercel.app frontend, fly.dev backend) needs "none";
    # in dev the SPA is same-origin via the Vite proxy so "lax" is fine.
    return "none" if _is_prod() else "lax"


def create_session(s: DBSession, user_id: int, request: Request) -> AuthSession:
    now = datetime.utcnow()
    sess = AuthSession(
        token=_new_token(),
        user_id=user_id,
        csrf_token=_new_token(),
        created_at=now,
        last_seen_at=now,
        expires_at=now + SESSION_LIFETIME,
        user_agent=(request.headers.get("user-agent") or "")[:255],
    )
    s.add(sess)
    s.commit()
    s.refresh(sess)
    return sess


def get_active_session(s: DBSession, token: str | None) -> Optional[AuthSession]:
    if not token:
        return None
    sess = s.exec(select(AuthSession).where(AuthSession.token == token)).first()
    if not sess or sess.expires_at <= datetime.utcnow():
        return None
    return sess


def delete_session(s: DBSession, token: str | None) -> None:
    if not token:
        return
    sess = s.exec(select(AuthSession).where(AuthSession.token == token)).first()
    if sess:
        s.delete(sess)
        s.commit()


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        secure=_secure_cookie(),
        samesite=_samesite(),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


# ----- Dependencies -----------------------------------------------------------
def current_user_optional(request: Request) -> Optional[User]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    with get_session() as s:
        sess = get_active_session(s, token)
        if not sess:
            return None
        user = s.get(User, sess.user_id)
        # Touch last_seen_at occasionally so we can show "active" sessions later.
        if datetime.utcnow() - sess.last_seen_at > LAST_SEEN_REFRESH_INTERVAL:
            sess.last_seen_at = datetime.utcnow()
            s.add(sess)
            s.commit()
        return user


def current_user(request: Request) -> User:
    user = current_user_optional(request)
    if user is None:
        raise LoginRequired()
    return user


# ----- CSRF -------------------------------------------------------------------
def get_csrf_token(request: Request) -> str:
    """Read the CSRF token tied to the current session (or '' if none)."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return ""
    with get_session() as s:
        sess = get_active_session(s, token)
        return sess.csrf_token if sess else ""


def csrf_protect_header(
    request: Request,
    x_csrf_token: str = Header(default="", alias="X-CSRF-Token"),
) -> None:
    """FastAPI dependency: rejects state-changing requests whose X-CSRF-Token header doesn't match the session's."""
    expected = get_csrf_token(request)
    if not expected or not secrets.compare_digest(expected, x_csrf_token):
        raise HTTPException(status_code=403, detail="CSRF token invalid or missing")
