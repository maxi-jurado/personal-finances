"""Tests del endpoint de consolidación `/api/summary?month=YYYY-MM` (Task 11).

Usa tasas cacheadas (D1): 1 USD = 150 JPY = 900 CLP. Verifica balance en las 3
monedas, que se agreguen todas las fuentes de gasto (mensual + fijo + tarjeta +
giro) y que solo cuenten los movimientos del mes consultado.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.models import Currency
from app.services import exchange_rates as fx

RATES = {
    Currency.USD: Decimal("1"),
    Currency.JPY: Decimal("150"),
    Currency.CLP: Decimal("900"),
}


@pytest.fixture()
def rates(db):
    """Siembra las tasas cacheadas de hoy (visible para el cliente)."""
    fx._store_rates(db, date.today(), dict(RATES))


def _dec(value) -> Decimal:
    return Decimal(str(value))


def test_month_invalido_da_422(client):
    assert client.get("/api/summary?month=2026-13").status_code == 422
    assert client.get("/api/summary?month=agosto").status_code == 422
    assert client.get("/api/summary").status_code == 422


def test_mes_sin_datos_da_ceros(client, rates):
    body = client.get("/api/summary?month=2026-08").json()
    for bucket in ("income", "expenses", "balance"):
        for cur in ("CLP", "JPY", "USD"):
            assert _dec(body[bucket][cur]) == Decimal("0")


def test_balance_en_las_tres_monedas(client, rates):
    # Ingreso 2 USD (= 1800 CLP = 300 JPY).
    client.post(
        "/api/income",
        json={
            "date": "2026-08-01",
            "description": "Sueldo",
            "category": "Salario",
            "currency": "USD",
            "amount": "2",
        },
    )
    # Gasto de tarjeta 900 CLP (= 1 USD = 150 JPY).
    client.post(
        "/api/card-expenses/1",
        json={"date": "2026-08-10", "description": "Compra", "category": "Varios", "amount_clp": "900"},
    )

    body = client.get("/api/summary?month=2026-08").json()

    assert _dec(body["income"]["USD"]) == Decimal("2")
    assert _dec(body["income"]["CLP"]) == Decimal("1800")
    assert _dec(body["income"]["JPY"]) == Decimal("300")

    assert _dec(body["expenses"]["USD"]) == Decimal("1")
    assert _dec(body["expenses"]["CLP"]) == Decimal("900")
    assert _dec(body["expenses"]["JPY"]) == Decimal("150")

    assert _dec(body["balance"]["USD"]) == Decimal("1")
    assert _dec(body["balance"]["CLP"]) == Decimal("900")
    assert _dec(body["balance"]["JPY"]) == Decimal("150")


def test_gastos_incluyen_todas_las_fuentes(client, rates):
    # monthly 150 JPY (=1 USD), card 900 CLP (=1 USD), transfer clp_charged 900 (=1 USD),
    # fixed 1 USD → total 4 USD en gastos.
    client.post(
        "/api/monthly-expenses",
        json={"date": "2026-08-05", "description": "Súper", "category": "Comida", "currency": "JPY", "amount": "150"},
    )
    client.post(
        "/api/card-expenses/1",
        json={"date": "2026-08-06", "description": "Ropa", "category": "Varios", "amount_clp": "900"},
    )
    client.post(
        "/api/transfers",
        json={"date": "2026-08-07", "jpy_requested": "100000", "clp_charged": "900"},
    )
    client.post(
        "/api/fixed-expenses",
        json={"concept": "Netflix", "currency": "USD", "amount": "1", "payment_day": 5},
    )

    body = client.get("/api/summary?month=2026-08").json()
    assert _dec(body["expenses"]["USD"]) == Decimal("4")


def test_gasto_fijo_cuenta_en_cualquier_mes(client, rates):
    # Los gastos fijos son recurrentes (sin fecha): cuentan en todo mes consultado.
    client.post(
        "/api/fixed-expenses",
        json={"concept": "Arriendo", "currency": "USD", "amount": "10", "payment_day": 1},
    )
    for month in ("2026-07", "2026-08", "2026-09"):
        body = client.get(f"/api/summary?month={month}").json()
        assert _dec(body["expenses"]["USD"]) == Decimal("10")


def test_card_debt_por_tarjeta(client, rates):
    client.post(
        "/api/card-expenses/1",
        json={"date": "2026-08-02", "description": "A", "category": "x", "amount_clp": "900"},
    )
    client.post(
        "/api/card-expenses/2",
        json={"date": "2026-08-03", "description": "B", "category": "y", "amount_clp": "1800"},
    )

    cards = client.get("/api/summary?month=2026-08").json()["cards"]
    by_id = {c["card_id"]: c for c in cards}
    assert _dec(by_id[1]["debt"]["CLP"]) == Decimal("900")
    assert _dec(by_id[1]["debt"]["USD"]) == Decimal("1")
    assert _dec(by_id[2]["debt"]["CLP"]) == Decimal("1800")
    assert _dec(by_id[2]["debt"]["USD"]) == Decimal("2")


def test_solo_cuenta_movimientos_del_mes(client, rates):
    client.post(
        "/api/income",
        json={"date": "2026-07-31", "description": "julio", "category": "s", "currency": "USD", "amount": "5"},
    )
    client.post(
        "/api/income",
        json={"date": "2026-08-01", "description": "agosto", "category": "s", "currency": "USD", "amount": "3"},
    )
    body = client.get("/api/summary?month=2026-08").json()
    assert _dec(body["income"]["USD"]) == Decimal("3")
