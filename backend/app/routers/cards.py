"""Router de tarjetas de crédito (solo lectura).

Expone las 2 tarjetas sembradas para que el frontend pueda ofrecerlas al
registrar gastos. No se crean/borran tarjetas en v1.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CreditCard
from app.schemas import ORMModel

router = APIRouter(prefix="/api/credit-cards", tags=["credit-cards"])


class CreditCardRead(ORMModel):
    id: int
    name: str


@router.get("", response_model=list[CreditCardRead])
def list_cards(db: Session = Depends(get_db)) -> list[CreditCard]:
    return db.query(CreditCard).order_by(CreditCard.id).all()
