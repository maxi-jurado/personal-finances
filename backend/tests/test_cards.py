"""Tests de tarjetas de crédito (Task 23).

Sin límite de cantidad (D17): las crea el usuario, con nombre, moneda y
cupo. No hay delete, se desactivan por estado. `available_credit` se
calcula: `credit_limit - gastos`.
"""

from __future__ import annotations

from decimal import Decimal


def _payload(**overrides):
    base = {"name": "Banco Santander", "currency": "CLP", "credit_limit": "500000"}
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/credit-cards")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_tarjeta(client):
    resp = client.post("/api/credit-cards", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Banco Santander"
    assert body["currency"] == "CLP"
    assert Decimal(body["credit_limit"]) == Decimal("500000")
    assert body["status"] == "activa"
    assert Decimal(body["available_credit"]) == Decimal("500000")


def test_crea_tarjetas_sin_limite_de_cantidad(client):
    for i in range(4):
        resp = client.post("/api/credit-cards", json=_payload(name=f"Tarjeta {i}"))
        assert resp.status_code == 201
    assert len(client.get("/api/credit-cards").json()) == 4


def test_rechaza_cupo_negativo(client):
    resp = client.post("/api/credit-cards", json=_payload(credit_limit="-1"))
    assert resp.status_code == 422


def test_rechaza_moneda_no_soportada(client):
    resp = client.post("/api/credit-cards", json=_payload(currency="EUR"))
    assert resp.status_code == 422


def test_actualiza_nombre_y_cupo(client):
    created = client.post("/api/credit-cards", json=_payload()).json()
    resp = client.patch(
        f"/api/credit-cards/{created['id']}", json={"name": "Falabella", "credit_limit": "700000"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Falabella"
    assert Decimal(body["credit_limit"]) == Decimal("700000")
    assert body["currency"] == "CLP"  # inmutable


def test_actualiza_tarjeta_inexistente_404(client):
    resp = client.patch("/api/credit-cards/9999", json={"name": "X"})
    assert resp.status_code == 404


def test_desactiva_y_reactiva_tarjeta(client):
    created = client.post("/api/credit-cards", json=_payload()).json()
    resp = client.patch(f"/api/credit-cards/{created['id']}/status", json={"status": "desactivada"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "desactivada"

    resp = client.patch(f"/api/credit-cards/{created['id']}/status", json={"status": "activa"})
    assert resp.json()["status"] == "activa"


def test_tarjeta_desactivada_no_aparece_por_defecto(client):
    created = client.post("/api/credit-cards", json=_payload()).json()
    client.patch(f"/api/credit-cards/{created['id']}/status", json={"status": "desactivada"})
    assert client.get("/api/credit-cards").json() == []


def test_tarjeta_desactivada_aparece_con_include_inactive(client):
    created = client.post("/api/credit-cards", json=_payload()).json()
    client.patch(f"/api/credit-cards/{created['id']}/status", json={"status": "desactivada"})
    listed = client.get("/api/credit-cards?include_inactive=true").json()
    assert [c["id"] for c in listed] == [created["id"]]


def test_available_credit_baja_con_gastos(client):
    card = client.post("/api/credit-cards", json=_payload(credit_limit="100000")).json()
    category = client.post("/api/categories", json={"name": "Varios"}).json()
    client.post(
        f"/api/card-expenses/{card['id']}",
        json={"date": "2026-08-05", "description": "Compra", "category_id": category["id"], "amount": "30000"},
    )
    listed = client.get("/api/credit-cards").json()
    assert Decimal(listed[0]["available_credit"]) == Decimal("70000")
