"""Router de tipo de cambio: expone las tasas vigentes (cacheadas)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency
from app.services import exchange_rates as fx

router = APIRouter(prefix="/api/exchange-rates", tags=["exchange-rates"])


class RatesLatest(BaseModel):
    date: date
    base: Currency
    rates: dict[Currency, Decimal]


@router.get("/latest", response_model=RatesLatest)
def latest(db: Session = Depends(get_db)) -> RatesLatest:
    try:
        rates = fx.get_daily_rates(db)
    except Exception as exc:  # sin cache y API caída
        raise HTTPException(
            status_code=503, detail="No hay tasas disponibles (API externa inaccesible)."
        ) from exc

    cached = fx.get_latest_cached(db)
    on = cached[0] if cached else fx._today()
    return RatesLatest(date=on, base=fx.BASE, rates=rates)
