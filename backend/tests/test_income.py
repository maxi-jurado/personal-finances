"""Tests de income CRUD (Task 6).

Cubre las 3 monedas (D10), validación de monto (`Decimal` > 0) y de moneda.
"""

from __future__ import annotations

from decimal import Decimal


def _payload(**overrides):
    base = {
        "date": "2026-08-01",
        "description": "Sueldo",
        "category": "Salario",
        "currency": "USD",
        "amount": "1234.56",
    }
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/income")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_income_usd_y_aparece(client):
    resp = client.post("/api/income", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] > 0
    assert body["currency"] == "USD"
    # El monto se serializa como string (Decimal) con la escala de Numeric(18,4).
    assert Decimal(body["amount"]) == Decimal("1234.56")

    listed = client.get("/api/income").json()
    assert len(listed) == 1
    assert listed[0]["description"] == "Sueldo"


def test_crea_income_en_las_tres_monedas(client):
    for cur, amt in [("CLP", "500000"), ("JPY", "80000"), ("USD", "600")]:
        resp = client.post("/api/income", json=_payload(currency=cur, amount=amt))
        assert resp.status_code == 201
    assert len(client.get("/api/income").json()) == 3


def test_rechaza_moneda_no_soportada(client):
    resp = client.post("/api/income", json=_payload(currency="EUR"))
    assert resp.status_code == 422


def test_rechaza_monto_no_positivo(client):
    assert client.post("/api/income", json=_payload(amount="0")).status_code == 422
    assert client.post("/api/income", json=_payload(amount="-5")).status_code == 422


def test_lista_ordenada_por_fecha_desc(client):
    client.post("/api/income", json=_payload(date="2026-07-01", description="julio"))
    client.post("/api/income", json=_payload(date="2026-08-01", description="agosto"))
    listed = client.get("/api/income").json()
    assert [i["description"] for i in listed] == ["agosto", "julio"]
