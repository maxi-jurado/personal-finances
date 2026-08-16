"""Router de gastos de tarjeta. Los montos van en CLP (`amount_clp`)."""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CardExpense, Category, CreditCard
from app.schemas import ORMModel

router = APIRouter(prefix="/api/card-expenses", tags=["card-expenses"])


class CardExpenseCreate(BaseModel):
    date: date_type
    description: str = Field(min_length=1)
    category_id: int
    amount_clp: Decimal = Field(gt=0)
    notes: str | None = None


class CardExpenseRead(ORMModel):
    id: int
    card_id: int
    date: date_type
    description: str
    category_id: int
    category_name: str
    amount_clp: Decimal
    notes: str | None = None


def _require_card(card_id: int, db: Session) -> CreditCard:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada.")
    return card


def _require_category(category_id: int, db: Session) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return category


@router.get("/{card_id}", response_model=list[CardExpenseRead])
def list_card_expenses(card_id: int, db: Session = Depends(get_db)) -> list[CardExpense]:
    _require_card(card_id, db)
    return (
        db.query(CardExpense)
        .filter(CardExpense.card_id == card_id)
        .order_by(CardExpense.date.desc(), CardExpense.id.desc())
        .all()
    )


@router.post("/{card_id}", response_model=CardExpenseRead, status_code=201)
def create_card_expense(
    card_id: int, payload: CardExpenseCreate, db: Session = Depends(get_db)
) -> CardExpense:
    _require_card(card_id, db)
    _require_category(payload.category_id, db)
    row = CardExpense(card_id=card_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
