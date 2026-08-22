"""Router de gastos fijos (fixed-expenses). Soporta las 3 monedas, y además
gastos denominados en UF (D14 extendido): se guarda la cantidad de UF y el
equivalente en CLP se calcula al vuelo, en vez de congelarlo al crear el
gasto — así sigue la fluctuación real.

La UF usada es la del **día de pago dentro del mes en curso**
(`payment_day`), no la de "hoy": un crédito que se cobra el día 1 usa la UF
del día 1, aunque se consulte la app el día 20. Si esa fecha exacta no está
cacheada (la API no tiene histórico), cae a la UF disponible más reciente.

Cada gasto fijo tiene un `payment_day` (1–31) que indica el día de pago
recurrente del mes.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency, FixedExpense
from app.schemas import ORMModel
from app.services import uf as uf_service

router = APIRouter(prefix="/api/fixed-expenses", tags=["fixed-expenses"])


class FixedExpenseCreate(BaseModel):
    concept: str = Field(min_length=1)
    currency: Currency
    amount: Decimal | None = Field(default=None, gt=0)
    uf_amount: Decimal | None = Field(default=None, gt=0)
    payment_day: int = Field(ge=1, le=31)
    notes: str | None = None

    @model_validator(mode="after")
    def _validar_monto(self) -> "FixedExpenseCreate":
        if (self.amount is None) == (self.uf_amount is None):
            raise ValueError("Indica amount o uf_amount, exactamente uno de los dos.")
        if self.uf_amount is not None and self.currency != Currency.CLP:
            raise ValueError("Un gasto en UF se registra en CLP (la UF solo convierte a CLP).")
        return self


class FixedExpenseRead(ORMModel):
    id: int
    concept: str
    currency: Currency
    amount: Decimal
    uf_amount: Decimal | None = None
    uf_value: Decimal | None = None  # valor de la UF usado para el cálculo, si aplica
    payment_day: int
    notes: str | None = None


def _to_read(row: FixedExpense, uf_value: Decimal | None) -> FixedExpenseRead:
    if row.uf_amount is not None:
        assert uf_value is not None
        return FixedExpenseRead(
            id=row.id,
            concept=row.concept,
            currency=row.currency,
            amount=row.uf_amount * uf_value,
            uf_amount=row.uf_amount,
            uf_value=uf_value,
            payment_day=row.payment_day,
            notes=row.notes,
        )
    return FixedExpenseRead(
        id=row.id,
        concept=row.concept,
        currency=row.currency,
        amount=row.amount,
        payment_day=row.payment_day,
        notes=row.notes,
    )


def _uf_for_payment_day_or_503(db: Session, payment_day: int) -> Decimal:
    today = uf_service._today()
    target = uf_service.payment_date_in_month(payment_day, today.year, today.month)
    try:
        return uf_service.get_uf_for_date(db, target)
    except Exception as exc:  # sin cache y API caída
        raise HTTPException(
            status_code=503,
            detail="No hay valor de UF disponible (API externa inaccesible).",
        ) from exc


@router.get("", response_model=list[FixedExpenseRead])
def list_fixed_expenses(db: Session = Depends(get_db)) -> list[FixedExpenseRead]:
    rows = (
        db.query(FixedExpense)
        .order_by(FixedExpense.payment_day.asc(), FixedExpense.id.asc())
        .all()
    )
    return [
        _to_read(
            r,
            _uf_for_payment_day_or_503(db, r.payment_day) if r.uf_amount is not None else None,
        )
        for r in rows
    ]


@router.post("", response_model=FixedExpenseRead, status_code=201)
def create_fixed_expense(
    payload: FixedExpenseCreate, db: Session = Depends(get_db)
) -> FixedExpenseRead:
    row = FixedExpense(
        concept=payload.concept,
        currency=payload.currency,
        amount=payload.amount,
        uf_amount=payload.uf_amount,
        payment_day=payload.payment_day,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    uf_value = (
        _uf_for_payment_day_or_503(db, row.payment_day) if row.uf_amount is not None else None
    )
    return _to_read(row, uf_value)
