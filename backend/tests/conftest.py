"""Configuración de tests.

Fuerza `DATABASE_URL` a una SQLite temporal ANTES de importar la app, para que
el engine a nivel de módulo nunca apunte a la base real `finanzas.db`.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="finanzas-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DIR / 'test.db'}"

import pytest  # noqa: E402

from app import database  # noqa: E402


@pytest.fixture(autouse=True)
def _schema():
    """Crea el schema (y seed) antes de cada test y limpia las tablas después."""
    database.init_db()
    yield
    with database.engine.begin() as conn:
        for table in reversed(database.Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture()
def db():
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
