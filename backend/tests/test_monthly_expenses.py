"""Tests de monthly-expenses CRUD (Task 8).

Cubre las 3 monedas, categoría vía FK a `categories` (D16), validación de
monto (`Decimal` > 0) y de moneda, incluida la recarga ICOCA como gasto (D12).
"""

from __future__ import annotations

from decimal import Decimal

import pytest


@pytest.fixture()
def category_id(client) -> int:
    resp = client.post("/api/categories", json={"name": "Comida"})
    return resp.json()["id"]


def _payload(category_id, **overrides):
    base = {
        "date": "2026-08-05",
        "description": "Supermercado",
        "category_id": category_id,
        "currency": "JPY",
        "amount": "8500",
    }
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/monthly-expenses")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_gasto_y_aparece(client, category_id):
    resp = client.post("/api/monthly-expenses", json=_payload(category_id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] > 0
    assert body["category_id"] == category_id
    assert body["category_name"] == "Comida"
    assert body["currency"] == "JPY"
    assert Decimal(body["amount"]) == Decimal("8500")

    listed = client.get("/api/monthly-expenses").json()
    assert len(listed) == 1
    assert listed[0]["description"] == "Supermercado"


def test_crea_gasto_en_las_tres_monedas(client, category_id):
    for cur, amt in [("CLP", "45000"), ("JPY", "8500"), ("USD", "30")]:
        resp = client.post(
            "/api/monthly-expenses", json=_payload(category_id, currency=cur, amount=amt)
        )
        assert resp.status_code == 201
    assert len(client.get("/api/monthly-expenses").json()) == 3


def test_recarga_icoca_como_gasto_jpy(client, category_id):
    # D12: la recarga ICOCA se registra como un gasto mensual en JPY.
    resp = client.post(
        "/api/monthly-expenses",
        json=_payload(category_id, description="Recarga ICOCA", amount="3000"),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["description"] == "Recarga ICOCA"
    assert body["currency"] == "JPY"


def test_rechaza_moneda_no_soportada(client, category_id):
    resp = client.post("/api/monthly-expenses", json=_payload(category_id, currency="EUR"))
    assert resp.status_code == 422


def test_rechaza_monto_no_positivo(client, category_id):
    assert client.post("/api/monthly-expenses", json=_payload(category_id, amount="0")).status_code == 422
    assert client.post("/api/monthly-expenses", json=_payload(category_id, amount="-5")).status_code == 422


def test_category_id_inexistente_404(client):
    resp = client.post("/api/monthly-expenses", json=_payload(9999))
    assert resp.status_code == 404


def test_lista_ordenada_por_fecha_desc(client, category_id):
    client.post(
        "/api/monthly-expenses", json=_payload(category_id, date="2026-07-01", description="julio")
    )
    client.post(
        "/api/monthly-expenses", json=_payload(category_id, date="2026-08-01", description="agosto")
    )
    listed = client.get("/api/monthly-expenses").json()
    assert [i["description"] for i in listed] == ["agosto", "julio"]
