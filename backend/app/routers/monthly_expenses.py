"""Router de gastos mensuales (monthly-expenses). Soporta las 3 monedas.

Aquí se registra la recarga ICOCA como un gasto más (D12); la categoría es
texto libre (D2).
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency, MonthlyExpense
from app.schemas import ORMModel

router = APIRouter(prefix="/api/monthly-expenses", tags=["monthly-expenses"])


class MonthlyExpenseCreate(BaseModel):
    date: date_type
    description: str = Field(min_length=1)
    category: str = Field(min_length=1)
    currency: Currency
    amount: Decimal = Field(gt=0)
    notes: str | None = None


class MonthlyExpenseRead(ORMModel):
    id: int
    date: date_type
    description: str
    category: str
    currency: Currency
    amount: Decimal
    notes: str | None = None


@router.get("", response_model=list[MonthlyExpenseRead])
def list_monthly_expenses(db: Session = Depends(get_db)) -> list[MonthlyExpense]:
    return (
        db.query(MonthlyExpense)
        .order_by(MonthlyExpense.date.desc(), MonthlyExpense.id.desc())
        .all()
    )


@router.post("", response_model=MonthlyExpenseRead, status_code=201)
def create_monthly_expense(
    payload: MonthlyExpenseCreate, db: Session = Depends(get_db)
) -> MonthlyExpense:
    row = MonthlyExpense(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
