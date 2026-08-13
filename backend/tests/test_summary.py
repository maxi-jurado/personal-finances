"""Tests del endpoint de consolidación `/api/summary?month=YYYY-MM` (Task 11).

Modelo de **saldo nativo por moneda**: cada moneda suma/resta solo sus propios
movimientos; el retiro mueve CLP→JPY (no es gasto); la conversión (tasa cacheada,
D1: 1 USD = 150 JPY = 900 CLP) se usa solo para el `total_equivalent`.
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
    for bucket in ("income", "expenses", "withdrawals", "balance", "total_equivalent"):
        for cur in ("CLP", "JPY", "USD"):
            assert _dec(body[bucket][cur]) == Decimal("0")


def test_saldo_nativo_por_moneda(client, rates):
    # Sueldo 2 USD; gasto de tarjeta 900 CLP.
    client.post(
        "/api/income",
        json={"date": "2026-08-01", "description": "Sueldo", "category": "Salario", "currency": "USD", "amount": "2"},
    )
    client.post(
        "/api/card-expenses/1",
        json={"date": "2026-08-10", "description": "Compra", "category": "Varios", "amount_clp": "900"},
    )

    body = client.get("/api/summary?month=2026-08").json()

    # Nativo: cada moneda solo con sus propios movimientos.
    assert _dec(body["income"]["USD"]) == Decimal("2")
    assert _dec(body["income"]["CLP"]) == Decimal("0")
    assert _dec(body["expenses"]["CLP"]) == Decimal("900")
    assert _dec(body["expenses"]["USD"]) == Decimal("0")
    assert _dec(body["balance"]["USD"]) == Decimal("2")
    assert _dec(body["balance"]["CLP"]) == Decimal("-900")
    assert _dec(body["balance"]["JPY"]) == Decimal("0")

    # Total equivalente: todo el patrimonio convertido a cada moneda.
    assert _dec(body["total_equivalent"]["USD"]) == Decimal("1")  # 2 USD − 900 CLP(=1 USD)
    assert _dec(body["total_equivalent"]["CLP"]) == Decimal("900")
    assert _dec(body["total_equivalent"]["JPY"]) == Decimal("150")


def test_retiro_mueve_clp_a_jpy_y_no_es_gasto(client, rates):
    # Banco cobra 65.000 CLP y entrega 10.000 JPY.
    client.post(
        "/api/transfers",
        json={"date": "2026-08-07", "jpy_requested": "10000", "clp_charged": "65000"},
    )

    body = client.get("/api/summary?month=2026-08").json()

    assert _dec(body["withdrawals"]["CLP"]) == Decimal("-65000")
    assert _dec(body["withdrawals"]["JPY"]) == Decimal("10000")
    # El retiro NO se cuenta como gasto.
    assert _dec(body["expenses"]["CLP"]) == Decimal("0")
    # El saldo nativo: CLP baja, JPY (efectivo) sube.
    assert _dec(body["balance"]["CLP"]) == Decimal("-65000")
    assert _dec(body["balance"]["JPY"]) == Decimal("10000")


def test_gasto_fijo_cuenta_en_cualquier_mes(client, rates):
    client.post(
        "/api/fixed-expenses",
        json={"concept": "Arriendo", "currency": "USD", "amount": "10", "payment_day": 1},
    )
    for month in ("2026-07", "2026-08", "2026-09"):
        body = client.get(f"/api/summary?month={month}").json()
        assert _dec(body["expenses"]["USD"]) == Decimal("10")
        assert _dec(body["balance"]["USD"]) == Decimal("-10")


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
