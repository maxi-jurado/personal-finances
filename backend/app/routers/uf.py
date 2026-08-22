"""Router de UF: expone el valor vigente (cacheado) en CLP."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import uf as uf_service

router = APIRouter(prefix="/api/uf", tags=["uf"])


class UFLatest(BaseModel):
    date: date
    value_clp: Decimal


@router.get("/latest", response_model=UFLatest)
def latest(db: Session = Depends(get_db)) -> UFLatest:
    try:
        value = uf_service.get_daily_uf(db)
    except Exception as exc:  # sin cache y API caída
        raise HTTPException(
            status_code=503, detail="No hay valor de UF disponible (API externa inaccesible)."
        ) from exc

    cached = uf_service.get_latest_cached_uf(db)
    on = cached[0] if cached else uf_service._today()
    return UFLatest(date=on, value_clp=value)
