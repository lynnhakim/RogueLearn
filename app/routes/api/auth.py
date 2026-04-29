"""JSON auth endpoints — signup, login, logout, me."""
from __future__ import annotations

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import select

from ... import auth
from ...db import get_session
from ...models import User
from ...schemas import AuthOut, LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LEN = 8


def _normalize_email(raw: str) -> str | None:
    try:
        result = validate_email(raw, check_deliverability=False)
        return result.normalized.lower()
    except EmailNotValidError:
        return None


def _user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, created_at=u.created_at)


@router.post("/signup", response_model=AuthOut)
def signup(body: SignupIn, request: Request, response: Response):
    normalized = _normalize_email(body.email)
    if not normalized:
        raise HTTPException(400, "That doesn't look like a real email.")
    if len(body.password) < MIN_PASSWORD_LEN:
        raise HTTPException(400, f"Password must be at least {MIN_PASSWORD_LEN} characters.")
    if body.password != body.password_confirm:
        raise HTTPException(400, "Passwords don't match.")

    with get_session() as s:
        if s.exec(select(User).where(User.email == normalized)).first():
            raise HTTPException(409, "An account with that email already exists.")
        user = User(email=normalized, password_hash=auth.hash_password(body.password))
        s.add(user)
        s.commit()
        s.refresh(user)
        sess = auth.create_session(s, user.id, request)
        out = AuthOut(user=_user_out(user), csrf_token=sess.csrf_token)

    auth.set_session_cookie(response, sess.token)
    return out


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, request: Request, response: Response):
    normalized = _normalize_email(body.email)
    generic_error = "Email or password is incorrect."

    with get_session() as s:
        user = None
        if normalized:
            user = s.exec(select(User).where(User.email == normalized)).first()
        if not user or not auth.verify_password(body.password, user.password_hash):
            raise HTTPException(401, generic_error)
        sess = auth.create_session(s, user.id, request)
        out = AuthOut(user=_user_out(user), csrf_token=sess.csrf_token)

    auth.set_session_cookie(response, sess.token)
    return out


@router.post("/logout", status_code=204, dependencies=[Depends(auth.csrf_protect_header)])
def logout(request: Request, response: Response):
    token = request.cookies.get(auth.SESSION_COOKIE)
    with get_session() as s:
        auth.delete_session(s, token)
    auth.clear_session_cookie(response)
    return Response(status_code=204)


@router.get("/me", response_model=AuthOut)
def me(request: Request):
    token = request.cookies.get(auth.SESSION_COOKIE)
    with get_session() as s:
        sess = auth.get_active_session(s, token)
        if not sess:
            raise HTTPException(401, "Not authenticated")
        user = s.get(User, sess.user_id)
        if not user:
            raise HTTPException(401, "Not authenticated")
        return AuthOut(user=_user_out(user), csrf_token=sess.csrf_token)
