"""Tests de fixed-expenses CRUD (Task 9).

Cubre las 3 monedas, `payment_day` en rango 1–31, y validación de monto
(`Decimal` > 0) y de moneda.
"""

from __future__ import annotations

from decimal import Decimal


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
