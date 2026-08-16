"""Tests de categorías de gasto (Task 18-19).

CRUD completo: nombre único, 404 sobre id inexistente, 409 sobre nombre
duplicado, y 409 al borrar una categoría referenciada por algún gasto.
"""

from __future__ import annotations


def _payload(**overrides):
    base = {"name": "Alimentación"}
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_categoria(client):
    resp = client.post("/api/categories", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Alimentación"
    assert isinstance(body["id"], int)

    listed = client.get("/api/categories").json()
    assert len(listed) == 1


def test_lista_ordenada_por_nombre(client):
    client.post("/api/categories", json=_payload(name="Transporte"))
    client.post("/api/categories", json=_payload(name="Alimentación"))
    names = [c["name"] for c in client.get("/api/categories").json()]
    assert names == ["Alimentación", "Transporte"]


def test_crea_categoria_nombre_duplicado_409(client):
    client.post("/api/categories", json=_payload())
    resp = client.post("/api/categories", json=_payload())
    assert resp.status_code == 409


def test_crea_categoria_nombre_vacio_422(client):
    resp = client.post("/api/categories", json=_payload(name=""))
    assert resp.status_code == 422


def test_actualiza_categoria(client):
    created = client.post("/api/categories", json=_payload()).json()
    resp = client.patch(f"/api/categories/{created['id']}", json={"name": "Comida"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Comida"


def test_actualiza_categoria_a_su_propio_nombre_no_falla(client):
    created = client.post("/api/categories", json=_payload()).json()
    resp = client.patch(f"/api/categories/{created['id']}", json=_payload())
    assert resp.status_code == 200


def test_actualiza_categoria_nombre_duplicado_409(client):
    client.post("/api/categories", json=_payload(name="Salud"))
    otra = client.post("/api/categories", json=_payload(name="Transporte")).json()
    resp = client.patch(f"/api/categories/{otra['id']}", json={"name": "Salud"})
    assert resp.status_code == 409


def test_actualiza_categoria_inexistente_404(client):
    resp = client.patch("/api/categories/9999", json={"name": "X"})
    assert resp.status_code == 404


def test_borra_categoria(client):
    created = client.post("/api/categories", json=_payload()).json()
    resp = client.delete(f"/api/categories/{created['id']}")
    assert resp.status_code == 204
    assert client.get("/api/categories").json() == []


def test_borra_categoria_inexistente_404(client):
    resp = client.delete("/api/categories/9999")
    assert resp.status_code == 404


def test_borra_categoria_en_uso_por_gasto_mensual_409(client):
    category = client.post("/api/categories", json=_payload()).json()
    client.post(
        "/api/monthly-expenses",
        json={
            "date": "2026-08-05",
            "description": "Super",
            "category_id": category["id"],
            "currency": "JPY",
            "amount": "1000",
        },
    )
    resp = client.delete(f"/api/categories/{category['id']}")
    assert resp.status_code == 409


def test_borra_categoria_en_uso_por_gasto_de_tarjeta_409(client):
    category = client.post("/api/categories", json=_payload()).json()
    card_id = client.get("/api/credit-cards").json()[0]["id"]
    client.post(
        f"/api/card-expenses/{card_id}",
        json={
            "date": "2026-08-05",
            "description": "Compra",
            "category_id": category["id"],
            "amount_clp": "1000",
        },
    )
    resp = client.delete(f"/api/categories/{category['id']}")
    assert resp.status_code == 409
