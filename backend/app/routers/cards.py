"""Router de tarjetas de crédito. CRUD completo (D17): nombre, moneda y cupo
total definidos por el usuario, sin límite de cantidad. No hay delete — se
desactivan por estado (igual filosofía que D15). `currency` es inmutable
después de creada, para no desvirtuar retroactivamente montos históricos.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CardStatus, CreditCard, Currency
from app.schemas import ORMModel
from app.services import cards as cards_service

router = APIRouter(prefix="/api/credit-cards", tags=["credit-cards"])


class CreditCardCreate(BaseModel):
    name: str = Field(min_length=1)
    currency: Currency
    credit_limit: Decimal = Field(ge=0)


class CreditCardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    credit_limit: Decimal | None = Field(default=None, ge=0)


class CreditCardStatusUpdate(BaseModel):
    status: CardStatus


class CreditCardRead(ORMModel):
    id: int
    name: str
    currency: Currency
    credit_limit: Decimal
    status: CardStatus
    available_credit: Decimal


def _read(db: Session, card: CreditCard) -> CreditCardRead:
    return CreditCardRead(
        id=card.id,
        name=card.name,
        currency=card.currency,
        credit_limit=card.credit_limit,
        status=card.status,
        available_credit=cards_service.available_credit(db, card),
    )


def _require_card(card_id: int, db: Session) -> CreditCard:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada.")
    return card


@router.get("", response_model=list[CreditCardRead])
def list_cards(
    include_inactive: bool = False, db: Session = Depends(get_db)
) -> list[CreditCardRead]:
    query = db.query(CreditCard)
    if not include_inactive:
        query = query.filter(CreditCard.status == CardStatus.ACTIVA)
    cards = query.order_by(CreditCard.name).all()
    return [_read(db, c) for c in cards]


@router.post("", response_model=CreditCardRead, status_code=201)
def create_card(payload: CreditCardCreate, db: Session = Depends(get_db)) -> CreditCardRead:
    card = CreditCard(
        name=payload.name, currency=payload.currency, credit_limit=payload.credit_limit
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _read(db, card)


@router.patch("/{card_id}", response_model=CreditCardRead)
def update_card(
    card_id: int, payload: CreditCardUpdate, db: Session = Depends(get_db)
) -> CreditCardRead:
    card = _require_card(card_id, db)
    if payload.name is not None:
        card.name = payload.name
    if payload.credit_limit is not None:
        card.credit_limit = payload.credit_limit
    db.commit()
    db.refresh(card)
    return _read(db, card)


@router.patch("/{card_id}/status", response_model=CreditCardRead)
def update_card_status(
    card_id: int, payload: CreditCardStatusUpdate, db: Session = Depends(get_db)
) -> CreditCardRead:
    card = _require_card(card_id, db)
    card.status = payload.status
    db.commit()
    db.refresh(card)
    return _read(db, card)
