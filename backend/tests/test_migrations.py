"""Verifica que la cadena de migraciones de Alembic reproduzca exactamente
el schema declarado en los modelos ORM (`Base.metadata`).

Corre contra un SQLite temporal propio, independiente del `DATABASE_URL` que
`conftest.py` fija para el resto de los tests (que siguen usando
`create_all()` directo, sin pasar por Alembic).
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_alembic_head_coincide_con_los_modelos(tmp_path):
    from app.database import Base

    db_path = tmp_path / "migrated.db"
    url = f"sqlite:///{db_path}"

    cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")

    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            mc = MigrationContext.configure(conn)
            diff = compare_metadata(mc, Base.metadata)
        assert diff == [], f"Migraciones desalineadas con los modelos: {diff}"
    finally:
        engine.dispose()
