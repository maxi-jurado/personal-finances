"""Modelos ORM (SQLAlchemy 2.0).

Alcance v1: exactamente 3 monedas (CLP, JPY, USD). Los montos usan `Numeric`
(nunca `float`) para evitar errores de redondeo en dinero.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Currency(str, enum.Enum):
    """Monedas soportadas en v1."""

    CLP = "CLP"
    JPY = "JPY"
    USD = "USD"


class ExpenseStatus(str, enum.Enum):
    """Estado de un gasto mensual (D15). No hay delete; anulado se excluye
    del balance pero el registro queda visible mediante filtro."""

    PAGADO = "pagado"
    ANULADO = "anulado"


# Tipos numéricos reutilizados. `amount` cubre las 3 monedas (JPY/CLP sin
# decimales, USD con 2); las tasas necesitan más precisión.
_MONEY = Numeric(18, 4)
_RATE = Numeric(20, 10)
_EFFECTIVE_RATE = Numeric(18, 6)


def _currency_col(**kwargs) -> Mapped[Currency]:
    return mapped_column(SAEnum(Currency, name="currency"), **kwargs)


class Config(Base):
    __tablename__ = "config"

    id: Mapped[int] = mapped_column(primary_key=True)
    currencies_json: Mapped[str] = mapped_column(String, nullable=False)
    base_currency: Mapped[Currency] = _currency_col(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    base_currency: Mapped[Currency] = _currency_col(nullable=False)
    target_currency: Mapped[Currency] = _currency_col(nullable=False)
    rate: Mapped[Decimal] = mapped_column(_RATE, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Income(Base):
    __tablename__ = "income"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[Currency] = _currency_col(nullable=False)
    amount: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)


class Category(Base):
    """Categoría de gasto (monthly_expenses / card_expenses). Income no la usa."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    expenses: Mapped[list["CardExpense"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )


class CardExpense(Base):
    __tablename__ = "card_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("credit_cards.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    amount_clp: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    card: Mapped["CreditCard"] = relationship(back_populates="expenses")
    category: Mapped["Category"] = relationship()

    @property
    def category_name(self) -> str:
        return self.category.name


class MonthlyExpense(Base):
    __tablename__ = "monthly_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    currency: Mapped[Currency] = _currency_col(nullable=False)
    amount: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[ExpenseStatus] = mapped_column(
        SAEnum(ExpenseStatus, name="expense_status"),
        nullable=False,
        default=ExpenseStatus.PAGADO,
        server_default=ExpenseStatus.PAGADO.value,
    )

    category: Mapped["Category"] = relationship()

    @property
    def category_name(self) -> str:
        return self.category.name


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    concept: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[Currency] = _currency_col(nullable=False)
    amount: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    payment_day: Mapped[int] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    jpy_requested: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    clp_charged: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    # effective_rate = clp_charged / jpy_requested (calculado en la app).
    effective_rate: Mapped[Decimal] = mapped_column(_EFFECTIVE_RATE, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
