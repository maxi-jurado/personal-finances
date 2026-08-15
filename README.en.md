# Personal Finances — CLP · JPY · USD

[Español](README.md) · **English**

A **local, single-user** app for tracking finances across three currencies:
Chilean peso (**CLP**), Japanese yen (**JPY**) and US dollar (**USD**). Built for
someone living in Japan with income and expenses spread across all three.

Backend **FastAPI + SQLAlchemy + SQLite**, frontend **React + TypeScript +
Tailwind (Vite)**, both in **Docker**. It's also an open-source portfolio piece,
so code quality, tests and documentation matter as much as it working.

> Runs 100% locally. No login, no multi-user, no network exposure: ports are
> bound only to `127.0.0.1`.

## What it does

- **First-run wizard**: pick your main currencies (min. 2 of CLP/JPY/USD) once.
- **Movement CRUD**:
  - **Income** in any of the 3 currencies.
  - **Card expenses** (2 Chilean credit cards, in CLP).
  - **Monthly expenses** (includes the ICOCA top-up as just another expense).
  - **Fixed expenses**, recurring (rent, loans, subscriptions) with a payment day.
  - **Money withdrawals** CLP→JPY: you record the JPY received and the CLP the
    bank charged you; the **effective rate** is computed for you.
- **Monthly dashboard** with a **native balance per currency** (green if positive,
  red if negative), the **total equivalent** converted to all 3 currencies, and
  **each card's debt** shown separately, in red.
- **Currency conversion** from **one** daily call to a public rates API (USD
  base), cached once a day. Amounts are stored in their native currency and
  converted only for display.

All money is handled with `Decimal`/`Numeric` (never `float`).

## Screenshots

> Generated from the demo data (`seed_demo.py`), 100% fictitious.

| Monthly dashboard | Recording a withdrawal |
|---|---|
| ![Dashboard](docs/img/dashboard.png) | ![Money withdrawal](docs/img/retiro.png) |

_To regenerate them: bring the app up with demo data (`./deploy.sh`) and save the
screenshots to `docs/img/`._

## Running the app

### Recommended: `deploy.sh`

A single command builds, brings up and opens a live console. If the database is
empty, it creates demo data automatically.

```bash
./deploy.sh
```

In the live console:

- **`Ctrl+C`** stops and tears down the stack before exiting.
- **`d`** detaches the console and leaves the stack running in the background.

Other commands:

```bash
./deploy.sh up --no-seed   # bring up without creating demo data (for real use)
./deploy.sh up --seed      # force-reload the demo data (replaces it)
./deploy.sh up --detach    # bring up and exit (no live console)
./deploy.sh seed           # seed demo data into an already-running backend
./deploy.sh down           # stop and remove the containers
./deploy.sh logs           # follow the logs
./deploy.sh status         # service status
```

Once it's up:

- **Frontend:** http://localhost:7413
- **API + docs (Swagger):** http://localhost:7412/docs

### Alternative: Docker Compose by hand

```bash
docker compose up --build -d
docker compose exec backend python scripts/seed_demo.py   # demo data (optional)
```

### Local development (no Docker)

Backend (from `backend/`, with a venv in `backend/.venv`):

```bash
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 7412
```

Frontend (from `frontend/`):

```bash
npm install
npm run dev        # dev server with /api → backend proxy
```

## Environment variables

Copy `.env.example` to `.env` and adjust it (never commit a real `.env`).

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `7412` | Backend port (uvicorn). |
| `FRONTEND_PORT` | `7413` | Frontend port (nginx serving Vite). |
| `FRONTEND_ORIGIN` | `http://localhost:7413` | Exact origin allowed by CORS (never `*`). |
| `EXCHANGE_RATE_API_URL` | `https://open.er-api.com/v6/latest/USD` | Rates API (free, no key). |
| `DATABASE_URL` | `sqlite:///…/finanzas.db` | Local dev only. In Docker it points to a persistent volume. |

Ports are deliberately unconventional to avoid clashing with other projects.

## Demo data (`seed_demo.py`)

`backend/scripts/seed_demo.py` populates ~5 months of income, expenses
(card/monthly/fixed) and withdrawals that are **fictitious but realistic**, plus
cached rates, so the app is usable as a demo.

- **Contains no real financial data** — nothing personal is versioned in the repo.
- It's **idempotent**: it replaces the movement tables, so running it several
  times always leaves the same state.
- `deploy.sh` runs it only if the database is empty; it **never overwrites
  existing data**.

```bash
# inside the container
docker compose exec backend python scripts/seed_demo.py
# or in local dev, from backend/
.venv/bin/python scripts/seed_demo.py
```

## Project structure

```
backend/
  app/
    main.py            # FastAPI entrypoint + CORS
    models.py          # ORM models (Numeric for money, Currency enum)
    routers/           # config, income, card/monthly/fixed expenses, transfers, summary…
    services/          # exchange_rates.py, summary.py
  scripts/seed_demo.py
  tests/               # pytest (temp SQLite, never the real DB)
  Dockerfile
frontend/
  src/{api,components,pages,lib}/
  Dockerfile · nginx.conf
docs/spec.md           # v1 spec + decisions D1–D14
tasks/                 # plan and progress
deploy.sh · docker-compose.yml
```

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

Prioritizes the 3 currency conversions, the withdrawal effective-rate
calculation, the consolidation endpoint (`/api/summary`) and the config/wizard
flow. Tests use a temporary SQLite and never touch the network or `finanzas.db`.

## Security

- Ports bound only to `127.0.0.1` (never `"7412:7412"` exposed to the whole network).
- CORS restricted to the frontend's exact origin, no wildcard.
- Always parameterized queries via the ORM; input validation with Pydantic.
- `.gitignore` covers `*.db`, `.env`, etc. No secrets in the repo.

## Design and decisions

The details live in [`docs/spec.md`](docs/spec.md), including decisions D1–D14
(e.g. **D13**: a withdrawal is a movement between currencies, not an expense;
**D14**: fixed expenses in UF, deferred to a v2). The spec is written in Spanish.
