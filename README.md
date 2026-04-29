# roguelearn

Turn your notes into a roguelike. Drop in a markdown / PDF / text file, an LLM extracts atomic flashcards, and you "run" the deck — wrong answers cost HP, streaks earn buffs (heal, hint, shield, focus), the run ends when you die or clear the deck. Mastery decays between runs so it stays useful long-term.

Live: **https://roguelearn.vercel.app**

## Stack

Two services that run independently:

- **Backend** (`app/`) — FastAPI JSON API. SQLite via SQLModel in dev; works with Postgres unchanged in prod. `argon2id` password hashing, DB-backed sessions, per-session CSRF tokens (`X-CSRF-Token` header), `HttpOnly` cookies (`SameSite=Lax` in dev, `SameSite=None; Secure` in `ENV=prod`). Google Gemini (`gemini-2.5-flash`) for card extraction and free-response grading.
- **Frontend** (`web/`) — Vite + React 19 + TypeScript SPA. React Router 7 for routing, TanStack Query for server state, Tailwind v4 for styling. Hand-drawn paper aesthetic (Kalam + Patrick Hand).

## Setup

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# 1. Paste your Gemini key from https://aistudio.google.com/apikey
# 2. Generate a SECRET_KEY:
python -c "import secrets; print(secrets.token_urlsafe(48))"
# 3. Paste it as SECRET_KEY in .env
```

> **Schema upgrade note:** if you ran an earlier (pre-auth) version, `rm data/roguelearn.db` before first run — the schema added `user_id` columns that the old DB doesn't have.

### Frontend

```bash
cd web
npm install
cp .env.example .env  # leave VITE_API_BASE_URL blank for dev (Vite proxies /api)
```

## Run (two terminals)

```bash
# Terminal 1 — backend
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd web && npm run dev
```

Open http://localhost:5173. You'll be redirected to `/login` — sign up first.

1. **Sign up** with email + password (≥ 8 chars).
2. **Upload** a `.md`, `.txt`, or `.pdf` of notes. Extraction runs in ~10–30s.
3. **Review** the extracted cards on the deck page; delete any junk.
4. **Start run** and answer free-response.

In dev the Vite server proxies `/api/*` to `http://localhost:8000`, so the SPA and API appear same-origin and cookies just work. Override the target with `VITE_API_PROXY_TARGET` if your API runs elsewhere.

## Mechanics

- **HP:** start with 5. Wrong answers cost 1–3 HP based on card difficulty.
- **Score:** difficulty × 100 × grade × streak multiplier.
- **Streak:** every 3 correct in a row awards a random buff.
  - `heal` — +2 HP, click to consume
  - `hint` — get a one-line hint on the next card without giving the answer
  - `shield` — next wrong answer absorbed, no HP loss
  - `focus` — next answer graded slightly leniently
- **Mastery:** each card has a 0–1 mastery score. Correct answers raise it, wrong drop it; decays with a 7-day half-life so old cards resurface.
- **Selection:** each turn picks the lowest-mastery card whose difficulty matches the current turn (difficulty ramps up over the run).

## Project layout

```
app/                       FastAPI JSON API
  main.py                  app entrypoint, CORS, startup hooks
  auth.py                  password hashing, sessions, CSRF (form + header), dependencies
  db.py                    SQLite/Postgres engine + session
  models.py                User / AuthSession / Deck / Card / Run / Attempt
  schemas.py               Pydantic request/response types — the API contract
  llm.py                   Gemini client + structured-output helper
  ingest.py                file -> chunks -> Gemini -> cards
  grader.py                free-response grader + hint generator
  run_engine.py            HP / buffs / mastery / card selection
  routes/
    api/
      auth.py              /api/auth/{signup,login,logout,me}
      decks.py             /api/decks, /api/decks/upload, /api/decks/{id}, ...
      runs.py              /api/decks/{id}/runs, /api/runs/{id}/{answer,heal,hint}

web/                       Vite + React SPA
  index.html
  vite.config.ts           dev proxy /api -> :8000, Tailwind v4 plugin
  src/
    main.tsx               entry
    App.tsx                router + providers (AuthProvider, QueryClientProvider)
    index.css              Tailwind import + hand-drawn design tokens
    api/
      client.ts            fetch wrapper (credentials: 'include', X-CSRF-Token header)
      types.ts             TS types — kept in sync with app/schemas.py
      hooks.ts             useDecks, useDeck, useRun, mutations
    auth/
      AuthContext.tsx      session state + CSRF token, /api/auth/me on mount
    components/
      Layout.tsx, Header.tsx, RequireAuth.tsx
      ui.tsx               PaperCard, Tape, Tack, StickyTag, Hearts, HandArrow
    pages/
      LoginPage, SignupPage, HomePage, DeckPage, RunPage
```

## Hosting

Backend on Fly.io, frontend on Vercel — Vercel rewrites `/api/*` to the Fly backend so the session cookie stays first-party. See `fly.toml`, `Dockerfile`, and `web/vercel.json`.

## Security posture

- Passwords hashed with **argon2id** (passlib's `argon2` scheme).
- Sessions are DB-backed with opaque random tokens (32 bytes from `secrets.token_urlsafe`); the cookie carries only the token, never user data.
- Cookies are `HttpOnly`; `SameSite=Lax` in dev, `SameSite=None; Secure` in prod (cross-origin SPA → API), with the Vercel proxy keeping them first-party in practice.
- Per-session **CSRF token** is required on every state-changing endpoint via the `X-CSRF-Token` header (login/signup are exempt — no session yet).
- Login error messages are deliberately generic ("Email or password is incorrect") to avoid leaking whether an email is registered.
- All deck/run access is scoped by `user_id` in the route handlers (`_owned_deck` / `_owned_run` helpers).

## What's intentionally not implemented yet

- Email verification (needs SMTP)
- Password reset (needs SMTP)
- "Log out other devices" (the data model supports it — `AuthSession` rows are per-device — just no UI yet)
- OAuth / SSO
