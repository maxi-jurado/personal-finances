"""Router de configuración: estado del wizard de primer arranque.

`GET /api/config` informa si la app ya está configurada; `POST /api/config`
guarda la selección de monedas del wizard (una sola vez).
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Config, Currency
from app.schemas import ConfigCreate, ConfigStatus

router = APIRouter(prefix="/api/config", tags=["config"])


def _to_status(cfg: Config) -> ConfigStatus:
    return ConfigStatus(
        configured=True,
        currencies=[Currency(c) for c in json.loads(cfg.currencies_json)],
        base_currency=cfg.base_currency,
    )


@router.get("", response_model=ConfigStatus)
def get_config(db: Session = Depends(get_db)) -> ConfigStatus:
    cfg = db.query(Config).first()
    if cfg is None:
        return ConfigStatus(configured=False)
    return _to_status(cfg)


@router.post("", response_model=ConfigStatus, status_code=201)
def create_config(payload: ConfigCreate, db: Session = Depends(get_db)) -> ConfigStatus:
    if db.query(Config).first() is not None:
        raise HTTPException(status_code=409, detail="La configuración ya existe.")

    cfg = Config(
        currencies_json=json.dumps([c.value for c in payload.currencies]),
        base_currency=payload.base_currency,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _to_status(cfg)
