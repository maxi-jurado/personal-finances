"""Configuración de la base de datos (SQLAlchemy 2.0 + SQLite).

La URL se lee de `DATABASE_URL` (para permitir DBs temporales en tests); por
defecto usa `finanzas.db` junto a la carpeta `backend/`. `init_db()` crea el
schema si no existe y siembra las 2 tarjetas de crédito.
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# `finanzas.db` en la raíz de backend/ (backend/app/database.py -> backend/)
_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "finanzas.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH}")

# `check_same_thread=False` es necesario para SQLite bajo el servidor ASGI.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base declarativa para todos los modelos ORM."""


def get_db() -> Session:
    """Dependencia FastAPI: entrega una sesión y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crea el schema (si falta) y siembra datos base. Idempotente."""
    # Import local para registrar los modelos en Base.metadata sin ciclos.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _seed_credit_cards()


def _seed_credit_cards() -> None:
    """Garantiza exactamente 2 tarjetas: 'Tarjeta 1' y 'Tarjeta 2'."""
    from app.models import CreditCard

    with SessionLocal() as db:
        if db.query(CreditCard).count() == 0:
            db.add_all([CreditCard(name="Tarjeta 1"), CreditCard(name="Tarjeta 2")])
            db.commit()
