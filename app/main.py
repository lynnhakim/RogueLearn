"""roguelearn — FastAPI app entrypoint."""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()  # populate env from .env BEFORE importing modules that read env

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from .auth import LoginRequired
from .db import init_db
from .routes.api.auth import router as api_auth_router
from .routes.api.decks import router as api_decks_router
from .routes.api.runs import router as api_runs_router

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)

app = FastAPI(title="roguelearn")

# CORS for the SPA frontend. FRONTEND_ORIGIN is comma-separated for multi-env (dev + prod).
_origins = [o.strip() for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    if not os.getenv("SECRET_KEY"):
        logging.warning("SECRET_KEY is not set — sessions are insecure. See .env.example.")


@app.exception_handler(LoginRequired)
async def _login_required_handler(request: Request, exc: LoginRequired):
    return JSONResponse({"detail": "Not authenticated"}, status_code=401)


@app.get("/healthz", include_in_schema=False)
def healthz():
    return PlainTextResponse("ok")


app.include_router(api_auth_router)
app.include_router(api_decks_router)
app.include_router(api_runs_router)
