"""Tests de card-expenses (Task 7).

Los gastos de tarjeta se registran en CLP contra una `card_id` válida; una
`card_id` inexistente devuelve 404. La categoría es una FK a `categories`
(D16).
"""

from __future__ import annotations

from decimal import Decimal

import pytest


def _card_ids(client) -> list[int]:
    cards = client.get("/api/credit-cards").json()
    return [c["id"] for c in cards]


@pytest.fixture()
def category_id(client) -> int:
    resp = client.post("/api/categories", json={"name": "Comida"})
    return resp.json()["id"]


def _payload(category_id, **overrides):
    base = {
        "date": "2026-08-05",
        "description": "Supermercado",
        "category_id": category_id,
        "amount_clp": "45990",
    }
    base.update(overrides)
    return base


def test_lista_de_tarjetas_tiene_dos(client):
    cards = client.get("/api/credit-cards").json()
    assert len(cards) == 2
    assert {c["name"] for c in cards} == {"Tarjeta 1", "Tarjeta 2"}


def test_lista_gastos_vacia_por_tarjeta(client):
    card_id = _card_ids(client)[0]
    resp = client.get(f"/api/card-expenses/{card_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_gasto_en_tarjeta_valida(client, category_id):
    card_id = _card_ids(client)[0]
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["card_id"] == card_id
    assert body["category_id"] == category_id
    assert body["category_name"] == "Comida"
    assert Decimal(body["amount_clp"]) == Decimal("45990")

    listed = client.get(f"/api/card-expenses/{card_id}").json()
    assert len(listed) == 1


def test_gastos_aislados_por_tarjeta(client, category_id):
    c1, c2 = _card_ids(client)
    client.post(f"/api/card-expenses/{c1}", json=_payload(category_id, description="en t1"))
    assert len(client.get(f"/api/card-expenses/{c1}").json()) == 1
    assert client.get(f"/api/card-expenses/{c2}").json() == []


def test_post_card_id_inexistente_404(client):
    resp = client.post("/api/card-expenses/9999", json=_payload(1))
    assert resp.status_code == 404


def test_get_card_id_inexistente_404(client):
    resp = client.get("/api/card-expenses/9999")
    assert resp.status_code == 404


def test_post_category_id_inexistente_404(client):
    card_id = _card_ids(client)[0]
    resp = client.post(f"/api/card-expenses/{card_id}", json=_payload(9999))
    assert resp.status_code == 404


def test_rechaza_monto_no_positivo(client, category_id):
    card_id = _card_ids(client)[0]
    assert client.post(f"/api/card-expenses/{card_id}", json=_payload(category_id, amount_clp="0")).status_code == 422
