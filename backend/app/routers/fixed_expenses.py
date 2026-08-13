"""Router de gastos fijos (fixed-expenses). Soporta las 3 monedas.

Cada gasto fijo tiene un `payment_day` (1–31) que indica el día de pago
recurrente del mes.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency, FixedExpense
from app.schemas import ORMModel

router = APIRouter(prefix="/api/fixed-expenses", tags=["fixed-expenses"])


class FixedExpenseCreate(BaseModel):
    concept: str = Field(min_length=1)
    currency: Currency
    amount: Decimal = Field(gt=0)
    payment_day: int = Field(ge=1, le=31)
    notes: str | None = None


class FixedExpenseRead(ORMModel):
    id: int
    concept: str
    currency: Currency
    amount: Decimal
    payment_day: int
    notes: str | None = None


@router.get("", response_model=list[FixedExpenseRead])
def list_fixed_expenses(db: Session = Depends(get_db)) -> list[FixedExpense]:
    return (
        db.query(FixedExpense)
        .order_by(FixedExpense.payment_day.asc(), FixedExpense.id.asc())
        .all()
    )


@router.post("", response_model=FixedExpenseRead, status_code=201)
def create_fixed_expense(
    payload: FixedExpenseCreate, db: Session = Depends(get_db)
) -> FixedExpense:
    row = FixedExpense(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
