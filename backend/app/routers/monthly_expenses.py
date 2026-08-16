"""Router de gastos mensuales (monthly-expenses). Soporta las 3 monedas.

Aquí se registra la recarga ICOCA como un gasto más (D12); la categoría es
una FK a `categories` (D16). No hay delete: los gastos se anulan por estado
(D15) y quedan ocultos por defecto salvo que se pida explícitamente verlos
(D18, filtros combinables).
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Currency, ExpenseStatus, MonthlyExpense
from app.schemas import ORMModel

router = APIRouter(prefix="/api/monthly-expenses", tags=["monthly-expenses"])

# YYYY-MM con mes válido 01–12 (formato inválido → 422 automático).
_MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class MonthlyExpenseCreate(BaseModel):
    date: date_type
    description: str = Field(min_length=1)
    category_id: int
    currency: Currency
    amount: Decimal = Field(gt=0)
    notes: str | None = None


class MonthlyExpenseRead(ORMModel):
    id: int
    date: date_type
    description: str
    category_id: int
    category_name: str
    currency: Currency
    amount: Decimal
    notes: str | None = None
    status: ExpenseStatus


class MonthlyExpenseStatusUpdate(BaseModel):
    status: ExpenseStatus


def _require_category(category_id: int, db: Session) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return category


def _require_expense(expense_id: int, db: Session) -> MonthlyExpense:
    expense = db.get(MonthlyExpense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    return expense


def _month_bounds(month: str) -> tuple[date_type, date_type]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date_type(year, mon, 1)
    end = date_type(year + 1, 1, 1) if mon == 12 else date_type(year, mon + 1, 1)
    return start, end


@router.get("", response_model=list[MonthlyExpenseRead])
def list_monthly_expenses(
    q: str | None = Query(None, min_length=1),
    category_id: int | None = None,
    date_from: date_type | None = None,
    date_to: date_type | None = None,
    month: str | None = Query(None, pattern=_MONTH_PATTERN),
    status: str | None = Query(None, pattern="^(pagado|anulado|all)$"),
    db: Session = Depends(get_db),
) -> list[MonthlyExpense]:
    if month is not None and (date_from is not None or date_to is not None):
        raise HTTPException(
            status_code=422, detail="No combines 'month' con 'date_from'/'date_to'."
        )

    query = db.query(MonthlyExpense)

    if status in (None, "pagado"):
        query = query.filter(MonthlyExpense.status == ExpenseStatus.PAGADO)
    elif status == "anulado":
        query = query.filter(MonthlyExpense.status == ExpenseStatus.ANULADO)
    # status == "all": sin filtro de estado.

    if q:
        query = query.filter(MonthlyExpense.description.ilike(f"%{q}%"))
    if category_id is not None:
        query = query.filter(MonthlyExpense.category_id == category_id)
    if month is not None:
        start, end = _month_bounds(month)
        query = query.filter(MonthlyExpense.date >= start, MonthlyExpense.date < end)
    if date_from is not None:
        query = query.filter(MonthlyExpense.date >= date_from)
    if date_to is not None:
        query = query.filter(MonthlyExpense.date <= date_to)

    return query.order_by(MonthlyExpense.date.desc(), MonthlyExpense.id.desc()).all()


@router.post("", response_model=MonthlyExpenseRead, status_code=201)
def create_monthly_expense(
    payload: MonthlyExpenseCreate, db: Session = Depends(get_db)
) -> MonthlyExpense:
    _require_category(payload.category_id, db)
    row = MonthlyExpense(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{expense_id}/status", response_model=MonthlyExpenseRead)
def update_monthly_expense_status(
    expense_id: int, payload: MonthlyExpenseStatusUpdate, db: Session = Depends(get_db)
) -> MonthlyExpense:
    expense = _require_expense(expense_id, db)
    expense.status = payload.status
    db.commit()
    db.refresh(expense)
    return expense
