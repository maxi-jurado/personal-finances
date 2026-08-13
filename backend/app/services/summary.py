"""Servicio de consolidación mensual.

Agrega ingresos y gastos (mensuales + fijos + tarjeta + giros) de un mes y los
expresa en las 3 monedas usando la **última tasa cacheada** (D1). No hace
conversión histórica por fecha de cada movimiento.

Reglas por fuente:
- income / monthly_expenses: monto en su moneda nativa, filtrados por `date`.
- card_expenses: `amount_clp` (CLP), filtrados por `date`. También se desglosan
  como deuda por tarjeta (D11).
- transfers: `clp_charged` (CLP) cuenta como gasto, filtrados por `date`.
- fixed_expenses: recurrentes (sin fecha) → cuentan en todo mes consultado.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CardExpense,
    CreditCard,
    Currency,
    FixedExpense,
    Income,
    MonthlyExpense,
    Transfer,
)
from app.services import exchange_rates as fx

_TARGETS = (Currency.CLP, Currency.JPY, Currency.USD)

# Escala de presentación por moneda (D4): CLP/JPY sin decimales, USD con 2.
_SCALE = {
    Currency.CLP: Decimal("1"),
    Currency.JPY: Decimal("1"),
    Currency.USD: Decimal("0.01"),
}


class SummaryError(RuntimeError):
    """No hay tasas cacheadas para consolidar montos con datos presentes."""


@dataclass
class CardDebt:
    card_id: int
    name: str
    debt: dict[Currency, Decimal]


@dataclass
class Summary:
    month: str
    rate_date: date | None
    income: dict[Currency, Decimal]
    expenses: dict[Currency, Decimal]
    balance: dict[Currency, Decimal]
    cards: list[CardDebt]


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _quantize(value: Decimal, currency: Currency) -> Decimal:
    return value.quantize(_SCALE[currency], rounding=ROUND_HALF_UP)


def _totals(
    items: list[tuple[Currency, Decimal]], rates: dict[Currency, Decimal]
) -> dict[Currency, Decimal]:
    """Convierte cada `(moneda, monto)` a las 3 monedas y acumula (sin redondear)."""
    out = {t: Decimal(0) for t in _TARGETS}
    for src, amount in items:
        for tgt in _TARGETS:
            out[tgt] += fx.convert(amount, src, tgt, rates)
    return out


def _quantized(raw: dict[Currency, Decimal]) -> dict[Currency, Decimal]:
    return {t: _quantize(raw[t], t) for t in _TARGETS}


def _zeros() -> dict[Currency, Decimal]:
    return {t: _quantize(Decimal(0), t) for t in _TARGETS}


def compute_summary(db: Session, year: int, month: int) -> Summary:
    start, end = _month_bounds(year, month)
    label = f"{year:04d}-{month:02d}"

    incomes = [
        (i.currency, i.amount)
        for i in db.scalars(
            select(Income).where(Income.date >= start, Income.date < end)
        )
    ]

    card_rows = list(
        db.scalars(
            select(CardExpense).where(CardExpense.date >= start, CardExpense.date < end)
        )
    )

    expense_items: list[tuple[Currency, Decimal]] = []
    for m in db.scalars(
        select(MonthlyExpense).where(
            MonthlyExpense.date >= start, MonthlyExpense.date < end
        )
    ):
        expense_items.append((m.currency, m.amount))
    for c in card_rows:
        expense_items.append((Currency.CLP, c.amount_clp))
    for t in db.scalars(
        select(Transfer).where(Transfer.date >= start, Transfer.date < end)
    ):
        expense_items.append((Currency.CLP, t.clp_charged))
    for f in db.scalars(select(FixedExpense)):
        expense_items.append((f.currency, f.amount))

    cards = list(db.scalars(select(CreditCard).order_by(CreditCard.id)))

    latest = fx.get_latest_cached(db)
    if latest is None:
        if incomes or expense_items:
            raise SummaryError("No hay tasas cacheadas para consolidar.")
        return Summary(
            month=label,
            rate_date=None,
            income=_zeros(),
            expenses=_zeros(),
            balance=_zeros(),
            cards=[CardDebt(c.id, c.name, _zeros()) for c in cards],
        )

    rate_date, rates = latest
    income_raw = _totals(incomes, rates)
    expense_raw = _totals(expense_items, rates)

    card_debt = []
    for card in cards:
        items = [(Currency.CLP, c.amount_clp) for c in card_rows if c.card_id == card.id]
        card_debt.append(CardDebt(card.id, card.name, _quantized(_totals(items, rates))))

    return Summary(
        month=label,
        rate_date=rate_date,
        income=_quantized(income_raw),
        expenses=_quantized(expense_raw),
        balance={t: _quantize(income_raw[t] - expense_raw[t], t) for t in _TARGETS},
        cards=card_debt,
    )
