"""Tests de pagos de tarjeta (Task 24).

Un pago repone cupo disponible; se permite incluso contra una tarjeta
desactivada. Una `card_id` inexistente devuelve 404.
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


def test_lista_pagos_vacia_por_tarjeta(client, card_id):
    resp = client.get(f"/api/card-payments/{card_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_pago(client, card_id):
    resp = client.post(
        f"/api/card-payments/{card_id}",
        json={"date": "2026-08-05", "amount": "50000", "notes": "Pago parcial"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["card_id"] == card_id
    assert Decimal(body["amount"]) == Decimal("50000")

    listed = client.get(f"/api/card-payments/{card_id}").json()
    assert len(listed) == 1


def test_get_card_id_inexistente_404(client):
    resp = client.get("/api/card-payments/9999")
    assert resp.status_code == 404


def test_post_card_id_inexistente_404(client):
    resp = client.post("/api/card-payments/9999", json={"date": "2026-08-05", "amount": "1000"})
    assert resp.status_code == 404


def test_rechaza_monto_no_positivo(client, card_id):
    resp = client.post(f"/api/card-payments/{card_id}", json={"date": "2026-08-05", "amount": "0"})
    assert resp.status_code == 422


def test_permite_pago_en_tarjeta_desactivada(client, card_id):
    client.patch(f"/api/credit-cards/{card_id}/status", json={"status": "desactivada"})
    resp = client.post(f"/api/card-payments/{card_id}", json={"date": "2026-08-05", "amount": "1000"})
    assert resp.status_code == 201


def test_pago_repone_cupo_disponible(client, card_id):
    category = client.post("/api/categories", json={"name": "Varios"}).json()
    client.post(
        f"/api/card-expenses/{card_id}",
        json={"date": "2026-08-05", "description": "Compra", "category_id": category["id"], "amount": "100000"},
    )
    client.post(f"/api/card-payments/{card_id}", json={"date": "2026-08-10", "amount": "40000"})

    listed = client.get("/api/credit-cards").json()
    # 500000 (cupo) - 100000 (gasto) + 40000 (pago) = 440000
    assert Decimal(listed[0]["available_credit"]) == Decimal("440000")
