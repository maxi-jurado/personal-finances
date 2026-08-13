"""Router de ingresos (income). Soporta las 3 monedas (D10)."""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Currency, Income
from app.schemas import ORMModel

router = APIRouter(prefix="/api/income", tags=["income"])


class IncomeCreate(BaseModel):
    date: date_type
    description: str = Field(min_length=1)
    category: str = Field(min_length=1)
    currency: Currency
    amount: Decimal = Field(gt=0)
    notes: str | None = None


class IncomeRead(ORMModel):
    id: int
    date: date_type
    description: str
    category: str
    currency: Currency
    amount: Decimal
    notes: str | None = None


@router.get("", response_model=list[IncomeRead])
def list_income(db: Session = Depends(get_db)) -> list[Income]:
    return db.query(Income).order_by(Income.date.desc(), Income.id.desc()).all()


@router.post("", response_model=IncomeRead, status_code=201)
def create_income(payload: IncomeCreate, db: Session = Depends(get_db)) -> Income:
    row = Income(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
