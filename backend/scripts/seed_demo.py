"""Siembra datos ficticios realistas para usar la app como demo.

~5 meses de movimientos (ingresos, gastos de tarjeta/mensuales/fijos, retiros)
repartidos por mes (D8), más tasas de cambio cacheadas para que el summary y el
dashboard queden poblados. **No** contiene datos reales.

Uso (desde `backend/`):
    .venv/bin/python scripts/seed_demo.py

Es idempotente: limpia las tablas de movimientos y las vuelve a sembrar, así que
correrlo varias veces deja siempre el mismo estado de demo.
"""

from __future__ import annotations

import sys
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

# Permite `import app.*` al ejecutar el script directamente desde backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json  # noqa: E402

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    CardExpense,
    Category,
    Config,
    CreditCard,
    Currency,
    ExchangeRate,
    FixedExpense,
    Income,
    MonthlyExpense,
    Transfer,
)
from app.services import exchange_rates as fx  # noqa: E402

# Tasas USD-base ficticias pero plausibles (1 USD ≈ 150 JPY ≈ 955 CLP).
DEMO_RATES = {
    Currency.USD: Decimal("1"),
    Currency.JPY: Decimal("150"),
    Currency.CLP: Decimal("955"),
}
_RATE_QUANTUM = Decimal("0.000001")

# Categorías (D16). Igual set que la migración 0002; se re-declara acá para
# que `seed_demo.py` funcione también sin haber corrido Alembic todavía.
_CATEGORY_NAMES = [
    "Alimentación",
    "Entretenimiento",
    "Estilo de Vida",
    "Gustos Personales",
    "Aseo y Limpieza",
    "Transporte",
    "Salud",
    "Vivienda y Servicios",
]

# Tablas de movimientos que el seed reemplaza por completo (idempotencia).
# `Category` queda afuera: es dato de referencia, sobrevive a los reseeds.
# `CreditCard` SÍ se wipea: desde D17 ya no es dato fijo sembrado una vez,
# es un movimiento más que el usuario define (como el resto de esta lista).
_MOVEMENT_MODELS = (
    Income,
    CardExpense,
    CreditCard,
    MonthlyExpense,
    FixedExpense,
    Transfer,
    ExchangeRate,
    Config,
)


def _recent_months(count: int) -> list[date]:
    """Primer día de los últimos `count` meses, del más antiguo al actual."""
    today = date.today()
    months = []
    for back in range(count - 1, -1, -1):
        month_index = today.month - 1 - back
        year = today.year + month_index // 12
        month = month_index % 12 + 1
        months.append(date(year, month, 1))
    return months


def _on(month_start: date, day: int) -> date:
    return month_start.replace(day=day)


def _effective_rate(clp_charged: Decimal, jpy_requested: Decimal) -> Decimal:
    return (clp_charged / jpy_requested).quantize(_RATE_QUANTUM, rounding=ROUND_HALF_UP)


def _wipe(db) -> None:
    for model in _MOVEMENT_MODELS:
        db.query(model).delete()
    db.commit()


def _ensure_categories(db) -> dict[str, int]:
    """Lookup-or-create de las categorías demo. No se wipea entre reseeds."""
    existing = {c.name: c.id for c in db.query(Category).all()}
    for name in _CATEGORY_NAMES:
        if name not in existing:
            category = Category(name=name)
            db.add(category)
            db.flush()
            existing[name] = category.id
    db.commit()
    return existing


def _seed_config(db) -> None:
    db.add(
        Config(
            currencies_json=json.dumps([c.value for c in Currency]),
            base_currency=Currency.CLP.value,
        )
    )
    db.commit()


def _seed_rates(db) -> None:
    fx._store_rates(db, date.today(), dict(DEMO_RATES))


def _seed_cards(db) -> dict[str, int]:
    """Crea 2 tarjetas demo (D17: sin límite de cantidad, definidas por el
    usuario). Se recrean en cada reseed, como el resto de los movimientos."""
    cards = [
        CreditCard(name="Tarjeta 1", currency=Currency.CLP, credit_limit=Decimal("800000")),
        CreditCard(name="Tarjeta 2", currency=Currency.CLP, credit_limit=Decimal("500000")),
    ]
    db.add_all(cards)
    db.flush()
    return {c.name: c.id for c in cards}


def _seed_fixed_expenses(db) -> None:
    """Gastos fijos recurrentes (sin fecha): aplican a todo mes."""
    db.add_all(
        [
            FixedExpense(concept="Arriendo depto", currency=Currency.JPY, amount=Decimal("72000"), payment_day=1),
            FixedExpense(concept="Crédito automotriz", currency=Currency.CLP, amount=Decimal("189000"), payment_day=5, notes="En la realidad va en UF (ver D14)."),
            FixedExpense(concept="Suscripciones (streaming)", currency=Currency.USD, amount=Decimal("18.99"), payment_day=10),
        ]
    )
    db.commit()


def _seed_monthly(
    db, months: list[date], categories: dict[str, int], cards: dict[str, int]
) -> None:
    card1, card2 = cards["Tarjeta 1"], cards["Tarjeta 2"]
    for i, m in enumerate(months):
        supermercado = Decimal("42000") + Decimal(1500) * i
        db.add_all(
            [
                Income(date=_on(m, 25), description="Sueldo Japón", category="Salario", currency=Currency.JPY, amount=Decimal("285000")),
                Income(date=_on(m, 5), description="Honorarios Chile", category="Freelance", currency=Currency.CLP, amount=Decimal("450000")),
                MonthlyExpense(date=_on(m, 3), description="Recarga ICOCA", category_id=categories["Transporte"], currency=Currency.JPY, amount=Decimal("3000")),
                MonthlyExpense(date=_on(m, 8), description="Supermercado", category_id=categories["Alimentación"], currency=Currency.JPY, amount=supermercado),
                MonthlyExpense(date=_on(m, 22), description="Supermercado", category_id=categories["Alimentación"], currency=Currency.JPY, amount=Decimal("18000")),
                MonthlyExpense(date=_on(m, 18), description="Farmacia", category_id=categories["Salud"], currency=Currency.JPY, amount=Decimal("6200")),
                CardExpense(card_id=card1, date=_on(m, 12), description="Compras online", category_id=categories["Estilo de Vida"], amount=Decimal("65000")),
                CardExpense(card_id=card1, date=_on(m, 20), description="Restaurant", category_id=categories["Alimentación"], amount=Decimal("32000") + Decimal(2000) * i),
                CardExpense(card_id=card2, date=_on(m, 15), description="Pasajes", category_id=categories["Transporte"], amount=Decimal("89000")),
            ]
        )
        # Ingreso ocasional en USD algunos meses.
        if i % 2 == 0:
            db.add(Income(date=_on(m, 15), description="Proyecto USD", category="Freelance", currency=Currency.USD, amount=Decimal("200")))
        # Retiro CLP→JPY mensual (efectivo en yenes).
        jpy = Decimal("100000")
        clp = Decimal("660000") + Decimal(3000) * i
        db.add(
            Transfer(
                date=_on(m, 10),
                jpy_requested=jpy,
                clp_charged=clp,
                effective_rate=_effective_rate(clp, jpy),
                notes="Retiro mensual de efectivo",
            )
        )
    db.commit()


def seed(months: int = 5) -> None:
    init_db()  # asegura el schema
    with SessionLocal() as db:
        _wipe(db)
        categories = _ensure_categories(db)
        cards = _seed_cards(db)
        _seed_config(db)
        _seed_rates(db)
        _seed_fixed_expenses(db)
        _seed_monthly(db, _recent_months(months), categories, cards)

        counts = {
            "categories": db.query(Category).count(),
            "income": db.query(Income).count(),
            "monthly_expenses": db.query(MonthlyExpense).count(),
            "card_expenses": db.query(CardExpense).count(),
            "fixed_expenses": db.query(FixedExpense).count(),
            "transfers": db.query(Transfer).count(),
            "exchange_rates": db.query(ExchangeRate).count(),
            "credit_cards": db.query(CreditCard).count(),
        }

    print(f"Seed listo: {months} meses de datos de demo.")
    for table, n in counts.items():
        print(f"  {table:18} {n}")


if __name__ == "__main__":
    seed()
