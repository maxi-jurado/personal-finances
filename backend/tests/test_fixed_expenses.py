"""Tests de fixed-expenses CRUD (Task 9).

Cubre las 3 monedas, `payment_day` en rango 1–31, validación de monto
(`Decimal` > 0) y de moneda, y gastos denominados en UF (D14 extendido).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services import uf as uf_service


@pytest.fixture()
def uf_value(db):
    """Siembra un valor de UF cacheado de hoy (visible para el cliente)."""
    value = Decimal("39000")
    uf_service._store_uf(db, uf_service._today(), value)
    return value


def _payload(**overrides):
    base = {
        "concept": "Arriendo",
        "currency": "JPY",
        "amount": "85000",
        "payment_day": 1,
    }
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/fixed-expenses")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_gasto_fijo_y_aparece(client):
    resp = client.post("/api/fixed-expenses", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] > 0
    assert body["concept"] == "Arriendo"
    assert body["currency"] == "JPY"
    assert body["payment_day"] == 1
    assert Decimal(body["amount"]) == Decimal("85000")

    listed = client.get("/api/fixed-expenses").json()
    assert len(listed) == 1
    assert listed[0]["concept"] == "Arriendo"


def test_crea_gasto_en_las_tres_monedas(client):
    for cur, amt in [("CLP", "300000"), ("JPY", "85000"), ("USD", "50")]:
        resp = client.post("/api/fixed-expenses", json=_payload(currency=cur, amount=amt))
        assert resp.status_code == 201
    assert len(client.get("/api/fixed-expenses").json()) == 3


def test_rechaza_moneda_no_soportada(client):
    resp = client.post("/api/fixed-expenses", json=_payload(currency="EUR"))
    assert resp.status_code == 422


def test_rechaza_monto_no_positivo(client):
    assert client.post("/api/fixed-expenses", json=_payload(amount="0")).status_code == 422
    assert client.post("/api/fixed-expenses", json=_payload(amount="-5")).status_code == 422


def test_rechaza_payment_day_fuera_de_rango(client):
    assert client.post("/api/fixed-expenses", json=_payload(payment_day=0)).status_code == 422
    assert client.post("/api/fixed-expenses", json=_payload(payment_day=32)).status_code == 422


def test_acepta_payment_day_limites(client):
    assert client.post("/api/fixed-expenses", json=_payload(payment_day=1)).status_code == 201
    assert client.post("/api/fixed-expenses", json=_payload(payment_day=31)).status_code == 201


def _uf_payload(**overrides):
    base = {
        "concept": "Crédito hipotecario",
        "currency": "CLP",
        "uf_amount": "8.5",
        "payment_day": 5,
    }
    base.update(overrides)
    return base


def test_crea_gasto_en_uf_y_calcula_el_equivalente_en_clp(client, uf_value):
    resp = client.post("/api/fixed-expenses", json=_uf_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert Decimal(body["uf_amount"]) == Decimal("8.5")
    assert Decimal(body["uf_value"]) == uf_value
    assert Decimal(body["amount"]) == Decimal("8.5") * uf_value

    listed = client.get("/api/fixed-expenses").json()
    assert len(listed) == 1
    assert Decimal(listed[0]["amount"]) == Decimal("8.5") * uf_value


def test_gasto_en_uf_sigue_la_fluctuacion_al_listar(client, db, uf_value):
    client.post("/api/fixed-expenses", json=_uf_payload())

    # Al día siguiente cambia la UF cacheada; el monto listado debe reflejarlo
    # (no queda congelado al valor de cuando se creó).
    nuevo_valor = Decimal("40100")
    uf_service._store_uf(db, uf_service._today(), nuevo_valor)

    listed = client.get("/api/fixed-expenses").json()
    assert Decimal(listed[0]["amount"]) == Decimal("8.5") * nuevo_valor


def test_usa_la_uf_del_dia_de_pago_no_la_de_hoy(client, db):
    today = uf_service._today()
    # payment_day cuyo día resuelto este mes es distinto de hoy.
    payment_day = 1 if today.day != 1 else 2
    target = uf_service.payment_date_in_month(payment_day, today.year, today.month)
    assert target != today

    uf_service._store_uf(db, target, Decimal("38000"))  # UF exacta del día de pago
    uf_service._store_uf(db, today, Decimal("50000"))  # UF de "hoy" — no debe usarse

    resp = client.post("/api/fixed-expenses", json=_uf_payload(payment_day=payment_day))
    body = resp.json()
    assert Decimal(body["uf_value"]) == Decimal("38000")
    assert Decimal(body["amount"]) == Decimal("8.5") * Decimal("38000")

    listed = client.get("/api/fixed-expenses").json()
    assert Decimal(listed[0]["amount"]) == Decimal("8.5") * Decimal("38000")


def test_rechaza_uf_sin_valor_cacheado_ni_api(client, monkeypatch):
    import httpx

    monkeypatch.setattr(uf_service, "_fetch_uf_value_clp", lambda: (_ for _ in ()).throw(httpx.HTTPError("caída")))

    resp = client.post("/api/fixed-expenses", json=_uf_payload())
    assert resp.status_code == 503


def test_rechaza_amount_y_uf_amount_juntos(client):
    resp = client.post(
        "/api/fixed-expenses", json=_uf_payload(amount="10000", uf_amount="8.5")
    )
    assert resp.status_code == 422


def test_rechaza_gasto_sin_amount_ni_uf_amount(client):
    payload = _uf_payload()
    del payload["uf_amount"]
    resp = client.post("/api/fixed-expenses", json=payload)
    assert resp.status_code == 422


def test_rechaza_uf_amount_en_moneda_distinta_de_clp(client, uf_value):
    resp = client.post("/api/fixed-expenses", json=_uf_payload(currency="JPY"))
    assert resp.status_code == 422


def test_rechaza_uf_amount_no_positivo(client, uf_value):
    assert client.post("/api/fixed-expenses", json=_uf_payload(uf_amount="0")).status_code == 422
    assert client.post("/api/fixed-expenses", json=_uf_payload(uf_amount="-1")).status_code == 422
