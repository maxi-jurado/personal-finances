"""Tests de card-expenses (Task 7, actualizado en Task 23).

El monto se registra en la moneda de la tarjeta padre (`card.currency`,
D17) — sin columna de moneda propia. Una `card_id` inexistente devuelve
404; una tarjeta desactivada rechaza gastos nuevos con 409. La categoría es
una FK a `categories` (D16).
"""

from __future__ import annotations

from decimal import Decimal

import pytest


@pytest.fixture()
def card_id(client) -> int:
    resp = client.post(
        "/api/credit-cards", json={"name": "Banco Santander", "currency": "CLP", "credit_limit": "500000"}
    )
    return resp.json()["id"]


@pytest.fixture()
def category_id(client) -> int:
    resp = client.post("/api/categories", json={"name": "Comida"})
    return resp.json()["id"]


def _payload(category_id, **overrides):
    base = {
        "date": "2026-08-05",
        "description": "Supermercado",
        "category_id": category_id,
        "amount": "45990",
    }
    base.update(overrides)
    return base


def test_lista_gastos_vacia_por_tarjeta(client, card_id):
    resp = client.get(f"/api/card-expenses/{card_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_gasto_en_tarjeta_valida(client, card_id, category_id):
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["card_id"] == card_id
    assert body["category_id"] == category_id
    assert body["category_name"] == "Comida"
    assert Decimal(body["amount"]) == Decimal("45990")

    listed = client.get(f"/api/card-expenses/{card_id}").json()
    assert len(listed) == 1


def test_gastos_aislados_por_tarjeta(client, category_id):
    c1 = client.post(
        "/api/credit-cards", json={"name": "T1", "currency": "CLP", "credit_limit": "100000"}
    ).json()["id"]
    c2 = client.post(
        "/api/credit-cards", json={"name": "T2", "currency": "CLP", "credit_limit": "100000"}
    ).json()["id"]
    client.post(f"/api/card-expenses/{c1}", json=_payload(category_id, description="en t1"))
    assert len(client.get(f"/api/card-expenses/{c1}").json()) == 1
    assert client.get(f"/api/card-expenses/{c2}").json() == []


def test_gasto_en_moneda_de_la_tarjeta(client, category_id):
    jpy_card = client.post(
        "/api/credit-cards", json={"name": "Tarjeta JPY", "currency": "JPY", "credit_limit": "100000"}
    ).json()
    resp = client.post(f"/api/card-expenses/{jpy_card['id']}", json=_payload(category_id))
    assert resp.status_code == 201


def test_post_card_id_inexistente_404(client, category_id):
    resp = client.post("/api/card-expenses/9999", json=_payload(category_id))
    assert resp.status_code == 404


def test_get_card_id_inexistente_404(client):
    resp = client.get("/api/card-expenses/9999")
    assert resp.status_code == 404


def test_post_category_id_inexistente_404(client, card_id):
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(9999))
    assert resp.status_code == 404


def test_rechaza_monto_no_positivo(client, card_id, category_id):
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id, amount="0"))
    assert resp.status_code == 422


def test_rechaza_gasto_en_tarjeta_desactivada(client, card_id, category_id):
    client.patch(f"/api/credit-cards/{card_id}/status", json={"status": "desactivada"})
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id))
    assert resp.status_code == 409


def test_gasto_visible_aunque_la_tarjeta_se_desactive_despues(client, card_id, category_id):
    client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id))
    client.patch(f"/api/credit-cards/{card_id}/status", json={"status": "desactivada"})
    listed = client.get(f"/api/card-expenses/{card_id}").json()
    assert len(listed) == 1
