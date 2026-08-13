"""Router de consolidación mensual: `GET /api/summary?month=YYYY-MM`.

Devuelve ingresos, gastos y balance del mes en las 3 monedas (usando la última
tasa cacheada, D1) más la deuda desglosada por tarjeta (D11).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency
from app.services import summary as summary_service

router = APIRouter(prefix="/api/summary", tags=["summary"])

# YYYY-MM con mes válido 01–12 (formato inválido → 422 automático).
_MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class CardDebtRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    card_id: int
    name: str
    debt: dict[Currency, Decimal]


class SummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month: str
    rate_date: date | None
    income: dict[Currency, Decimal]  # nativo por moneda
    expenses: dict[Currency, Decimal]  # nativo por moneda
    withdrawals: dict[Currency, Decimal]  # patas del retiro: CLP ≤ 0, JPY ≥ 0
    balance: dict[Currency, Decimal]  # nativo por moneda
    total_equivalent: dict[Currency, Decimal]  # balance consolidado y convertido
    cards: list[CardDebtRead]


@router.get("", response_model=SummaryRead)
def get_summary(
    month: str = Query(pattern=_MONTH_PATTERN),
    db: Session = Depends(get_db),
) -> summary_service.Summary:
    year, mon = int(month[:4]), int(month[5:7])
    try:
        return summary_service.compute_summary(db, year, mon)
    except summary_service.SummaryError as exc:
        raise HTTPException(
            status_code=503,
            detail="No hay tasas de cambio cacheadas; consulta /api/exchange-rates/latest primero.",
        ) from exc
