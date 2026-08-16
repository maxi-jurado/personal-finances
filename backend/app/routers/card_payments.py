"""Router de pagos de tarjeta (D17). Repone cupo disponible; se permite
incluso contra una tarjeta desactivada (saldar una deuda es válido aunque
ya no se use la tarjeta para gastar).
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CardPayment, CreditCard
from app.schemas import ORMModel

router = APIRouter(prefix="/api/card-payments", tags=["card-payments"])


class CardPaymentCreate(BaseModel):
    date: date_type
    amount: Decimal = Field(gt=0)
    notes: str | None = None


class CardPaymentRead(ORMModel):
    id: int
    card_id: int
    date: date_type
    amount: Decimal
    notes: str | None = None


def _require_card(card_id: int, db: Session) -> CreditCard:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada.")
    return card


@router.get("/{card_id}", response_model=list[CardPaymentRead])
def list_card_payments(card_id: int, db: Session = Depends(get_db)) -> list[CardPayment]:
    _require_card(card_id, db)
    return (
        db.query(CardPayment)
        .filter(CardPayment.card_id == card_id)
        .order_by(CardPayment.date.desc(), CardPayment.id.desc())
        .all()
    )


@router.post("/{card_id}", response_model=CardPaymentRead, status_code=201)
def create_card_payment(
    card_id: int, payload: CardPaymentCreate, db: Session = Depends(get_db)
) -> CardPayment:
    _require_card(card_id, db)
    row = CardPayment(card_id=card_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
