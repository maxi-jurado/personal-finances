"""Punto de entrada de la API FastAPI.

Crea el schema al arrancar (D: primer arranque) y restringe CORS al origin
exacto del frontend (nunca wildcard).
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import (
    card_expenses,
    cards,
    config,
    exchange_rates,
    fixed_expenses,
    income,
    monthly_expenses,
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:7413")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Finanzas Personales API", version="0.1.0", lifespan=lifespan)

# CORS restringido al origin exacto del frontend (requisito de seguridad).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config.router)
app.include_router(exchange_rates.router)
app.include_router(income.router)
app.include_router(cards.router)
app.include_router(card_expenses.router)
app.include_router(monthly_expenses.router)
app.include_router(fixed_expenses.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
