"""Cupo disponible de una tarjeta (D17).

Calculado, no almacenado. `credit_limit - gastos`; se extiende en la tarea
de pagos de tarjeta para sumar los pagos registrados.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CardExpense, CreditCard


def available_credit(db: Session, card: CreditCard) -> Decimal:
    spent = (
        db.scalar(
            select(func.coalesce(func.sum(CardExpense.amount), 0)).where(
                CardExpense.card_id == card.id
            )
        )
        or Decimal(0)
    )
    return card.credit_limit - spent
