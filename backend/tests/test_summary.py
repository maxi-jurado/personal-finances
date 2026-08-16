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


@pytest.fixture()
def category_id(client) -> int:
    resp = client.post("/api/categories", json={"name": "Varios"})
    return resp.json()["id"]


def _card(client, **overrides) -> int:
    base = {"name": "Banco Santander", "currency": "CLP", "credit_limit": "500000"}
    base.update(overrides)
    return client.post("/api/credit-cards", json=base).json()["id"]


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


def test_saldo_nativo_por_moneda(client, rates, category_id):
    # Sueldo 2 USD; gasto de tarjeta 900 CLP.
    card_id = _card(client)
    client.post(
        "/api/income",
        json={"date": "2026-08-01", "description": "Sueldo", "category": "Salario", "currency": "USD", "amount": "2"},
    )
    client.post(
        f"/api/card-expenses/{card_id}",
        json={"date": "2026-08-10", "description": "Compra", "category_id": category_id, "amount": "900"},
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


def test_card_debt_por_tarjeta(client, rates, category_id):
    clp_card = _card(client, name="CLP card", currency="CLP")
    client.post(
        f"/api/card-expenses/{clp_card}",
        json={"date": "2026-08-02", "description": "A", "category_id": category_id, "amount": "900"},
    )

    cards = client.get("/api/summary?month=2026-08").json()["cards"]
    by_id = {c["card_id"]: c for c in cards}
    assert _dec(by_id[clp_card]["debt"]["CLP"]) == Decimal("900")
    assert _dec(by_id[clp_card]["debt"]["USD"]) == Decimal("1")


def test_card_debt_en_moneda_nativa_de_cada_tarjeta(client, rates, category_id):
    # D17: cada tarjeta guarda su deuda en su propia moneda, no forzada a CLP.
    clp_card = _card(client, name="CLP card", currency="CLP")
    jpy_card = _card(client, name="JPY card", currency="JPY")
    client.post(
        f"/api/card-expenses/{clp_card}",
        json={"date": "2026-08-02", "description": "A", "category_id": category_id, "amount": "900"},
    )
    client.post(
        f"/api/card-expenses/{jpy_card}",
        json={"date": "2026-08-03", "description": "B", "category_id": category_id, "amount": "300"},
    )

    cards = client.get("/api/summary?month=2026-08").json()["cards"]
    by_id = {c["card_id"]: c for c in cards}
    # Cada deuda se expresa nativa y convertida a las otras 2 monedas (D1
    # rates: 1 USD = 150 JPY = 900 CLP) — no se mezclan entre tarjetas.
    assert _dec(by_id[clp_card]["debt"]["CLP"]) == Decimal("900")
    assert _dec(by_id[clp_card]["debt"]["JPY"]) == Decimal("150")
    assert _dec(by_id[clp_card]["debt"]["USD"]) == Decimal("1")
    assert _dec(by_id[jpy_card]["debt"]["JPY"]) == Decimal("300")
    assert _dec(by_id[jpy_card]["debt"]["CLP"]) == Decimal("1800")
    assert _dec(by_id[jpy_card]["debt"]["USD"]) == Decimal("2")


def test_sin_tasas_ni_datos_da_ceros(client):
    # Sin tasas cacheadas y sin movimientos: ceros y rate_date nulo (no 503).
    body = client.get("/api/summary?month=2026-08").json()
    assert body["rate_date"] is None
    for cur in ("CLP", "JPY", "USD"):
        assert _dec(body["balance"][cur]) == Decimal("0")


def test_sin_tasas_con_datos_da_503(client):
    # Hay movimientos pero no hay tasas cacheadas → no se puede consolidar.
    client.post(
        "/api/income",
        json={"date": "2026-08-01", "description": "x", "category": "s", "currency": "USD", "amount": "1"},
    )
    assert client.get("/api/summary?month=2026-08").status_code == 503


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
