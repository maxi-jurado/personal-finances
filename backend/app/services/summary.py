"""Servicio de consolidación mensual (modelo de saldo nativo por moneda).

Cada moneda mantiene su propio saldo, sumando/restando **solo** los movimientos
en esa moneda (D3). La conversión (con la última tasa cacheada, D1) se usa solo
para el "total equivalente": el patrimonio del mes expresado en las 3 monedas.

Reglas por fuente:
- income / monthly_expenses: monto en su moneda nativa, filtrados por `date`.
- card_expenses: `amount_clp` (CLP), filtrados por `date`. También se desglosan
  como deuda por tarjeta (D11).
- fixed_expenses: recurrentes (sin fecha) → cuentan en todo mes consultado.
- transfers (retiro de dinero): NO es un gasto. Mueve plata entre monedas:
  descuenta `clp_charged` del saldo CLP y suma `jpy_requested` al saldo JPY.
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
    ExpenseStatus,
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
    """No hay tasas cacheadas para consolidar el total equivalente con datos."""


@dataclass
class CardDebt:
    card_id: int
    name: str
    debt: dict[Currency, Decimal]


@dataclass
class Summary:
    month: str
    rate_date: date | None
    income: dict[Currency, Decimal]  # nativo por moneda
    expenses: dict[Currency, Decimal]  # nativo por moneda (mensual + tarjeta + fijo)
    withdrawals: dict[Currency, Decimal]  # patas del retiro: CLP ≤ 0, JPY ≥ 0
    balance: dict[Currency, Decimal]  # income − expenses + withdrawals, nativo
    total_equivalent: dict[Currency, Decimal]  # balance consolidado y convertido
    cards: list[CardDebt]


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _quantize(value: Decimal, currency: Currency) -> Decimal:
    return value.quantize(_SCALE[currency], rounding=ROUND_HALF_UP)


def _quantized(raw: dict[Currency, Decimal]) -> dict[Currency, Decimal]:
    return {t: _quantize(raw[t], t) for t in _TARGETS}


def _zeros() -> dict[Currency, Decimal]:
    return {t: _quantize(Decimal(0), t) for t in _TARGETS}


def _native_sums(items: list[tuple[Currency, Decimal]]) -> dict[Currency, Decimal]:
    """Suma montos en su moneda nativa, sin convertir."""
    out = {t: Decimal(0) for t in _TARGETS}
    for currency, amount in items:
        out[currency] += amount
    return out


def _to_currency(
    native: dict[Currency, Decimal], target: Currency, rates: dict[Currency, Decimal]
) -> Decimal:
    """Convierte un saldo nativo por moneda a una sola moneda y acumula."""
    return sum(
        (fx.convert(native[src], src, target, rates) for src in _TARGETS), Decimal(0)
    )


def compute_summary(db: Session, year: int, month: int) -> Summary:
    start, end = _month_bounds(year, month)
    label = f"{year:04d}-{month:02d}"

    income_items = [
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
            MonthlyExpense.date >= start,
            MonthlyExpense.date < end,
            MonthlyExpense.status == ExpenseStatus.PAGADO,
        )
    ):
        expense_items.append((m.currency, m.amount))
    for c in card_rows:
        expense_items.append((Currency.CLP, c.amount_clp))
    for f in db.scalars(select(FixedExpense)):
        expense_items.append((f.currency, f.amount))

    # Retiros: dos patas nativas, no son gasto.
    withdrawals = {t: Decimal(0) for t in _TARGETS}
    transfer_rows = list(
        db.scalars(select(Transfer).where(Transfer.date >= start, Transfer.date < end))
    )
    for t in transfer_rows:
        withdrawals[Currency.CLP] -= t.clp_charged
        withdrawals[Currency.JPY] += t.jpy_requested

    cards = list(db.scalars(select(CreditCard).order_by(CreditCard.id)))

    income_raw = _native_sums(income_items)
    expense_raw = _native_sums(expense_items)
    balance_raw = {t: income_raw[t] - expense_raw[t] + withdrawals[t] for t in _TARGETS}

    has_movements = bool(income_items or expense_items or transfer_rows)
    latest = fx.get_latest_cached(db)
    if latest is None:
        if has_movements:
            raise SummaryError("No hay tasas cacheadas para consolidar.")
        return Summary(
            month=label,
            rate_date=None,
            income=_zeros(),
            expenses=_zeros(),
            withdrawals=_zeros(),
            balance=_zeros(),
            total_equivalent=_zeros(),
            cards=[CardDebt(c.id, c.name, _zeros()) for c in cards],
        )

    rate_date, rates = latest
    total_equivalent = {t: _to_currency(balance_raw, t, rates) for t in _TARGETS}

    card_debt = []
    for card in cards:
        clp = sum(
            (c.amount_clp for c in card_rows if c.card_id == card.id), Decimal(0)
        )
        native = {Currency.CLP: clp, Currency.JPY: Decimal(0), Currency.USD: Decimal(0)}
        debt = {t: _to_currency(native, t, rates) for t in _TARGETS}
        card_debt.append(CardDebt(card.id, card.name, _quantized(debt)))

    return Summary(
        month=label,
        rate_date=rate_date,
        income=_quantized(income_raw),
        expenses=_quantized(expense_raw),
        withdrawals=_quantized(withdrawals),
        balance=_quantized(balance_raw),
        total_equivalent=_quantized(total_equivalent),
        cards=card_debt,
    )
