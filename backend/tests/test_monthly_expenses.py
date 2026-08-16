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
    assert body["status"] == "pagado"
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


# --- Estado (D15): anular no borra, se excluye por defecto -----------------


def test_anula_gasto_via_patch_status(client, category_id):
    created = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    resp = client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "anulado"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "anulado"


def test_reactiva_gasto_anulado(client, category_id):
    created = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "anulado"})
    resp = client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "pagado"})
    assert resp.json()["status"] == "pagado"


def test_status_update_gasto_inexistente_404(client):
    resp = client.patch("/api/monthly-expenses/9999/status", json={"status": "anulado"})
    assert resp.status_code == 404


def test_status_invalido_422(client, category_id):
    created = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    resp = client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "borrado"})
    assert resp.status_code == 422


def test_gasto_anulado_no_aparece_por_defecto(client, category_id):
    created = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "anulado"})
    assert client.get("/api/monthly-expenses").json() == []


def test_gasto_anulado_aparece_con_filtro_status_anulado(client, category_id):
    created = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "anulado"})
    listed = client.get("/api/monthly-expenses?status=anulado").json()
    assert [i["id"] for i in listed] == [created["id"]]


def test_status_all_muestra_pagados_y_anulados(client, category_id):
    a = client.post("/api/monthly-expenses", json=_payload(category_id)).json()
    b = client.post("/api/monthly-expenses", json=_payload(category_id, date="2026-08-06")).json()
    client.patch(f"/api/monthly-expenses/{a['id']}/status", json={"status": "anulado"})
    listed = client.get("/api/monthly-expenses?status=all").json()
    assert {i["id"] for i in listed} == {a["id"], b["id"]}


# --- Filtros combinables (D18) ----------------------------------------------


def test_filtro_texto_en_descripcion(client, category_id):
    client.post("/api/monthly-expenses", json=_payload(category_id, description="Supermercado Lider"))
    client.post("/api/monthly-expenses", json=_payload(category_id, description="Farmacia"))
    listed = client.get("/api/monthly-expenses?q=super").json()
    assert [i["description"] for i in listed] == ["Supermercado Lider"]


def test_filtro_por_categoria(client, category_id):
    otra = client.post("/api/categories", json={"name": "Salud"}).json()["id"]
    client.post("/api/monthly-expenses", json=_payload(category_id, description="A"))
    client.post("/api/monthly-expenses", json=_payload(otra, description="B"))
    listed = client.get(f"/api/monthly-expenses?category_id={otra}").json()
    assert [i["description"] for i in listed] == ["B"]


def test_filtro_por_mes(client, category_id):
    client.post("/api/monthly-expenses", json=_payload(category_id, date="2026-07-15", description="julio"))
    client.post("/api/monthly-expenses", json=_payload(category_id, date="2026-08-15", description="agosto"))
    listed = client.get("/api/monthly-expenses?month=2026-08").json()
    assert [i["description"] for i in listed] == ["agosto"]


def test_filtro_por_rango_de_fechas(client, category_id):
    client.post("/api/monthly-expenses", json=_payload(category_id, date="2026-08-01", description="temprano"))
    client.post("/api/monthly-expenses", json=_payload(category_id, date="2026-08-20", description="tarde"))
    listed = client.get("/api/monthly-expenses?date_from=2026-08-10&date_to=2026-08-25").json()
    assert [i["description"] for i in listed] == ["tarde"]


def test_filtro_month_y_date_from_juntos_422(client):
    resp = client.get("/api/monthly-expenses?month=2026-08&date_from=2026-08-01")
    assert resp.status_code == 422


def test_filtro_mes_invalido_422(client):
    resp = client.get("/api/monthly-expenses?month=2026-13")
    assert resp.status_code == 422


def test_filtros_combinables(client, category_id):
    otra = client.post("/api/categories", json={"name": "Salud"}).json()["id"]
    client.post(
        "/api/monthly-expenses",
        json=_payload(category_id, date="2026-08-05", description="Supermercado Lider"),
    )
    client.post(
        "/api/monthly-expenses",
        json=_payload(category_id, date="2026-07-05", description="Supermercado Jumbo"),
    )
    client.post(
        "/api/monthly-expenses", json=_payload(otra, date="2026-08-05", description="Supermercado raro")
    )
    listed = client.get(f"/api/monthly-expenses?q=super&category_id={category_id}&month=2026-08").json()
    assert [i["description"] for i in listed] == ["Supermercado Lider"]


def test_summary_excluye_gasto_anulado(client, category_id):
    from datetime import date

    from app.services import exchange_rates as fx
    from app.database import SessionLocal

    with SessionLocal() as db:
        fx._store_rates(db, date.today(), {"USD": Decimal("1"), "JPY": Decimal("150"), "CLP": Decimal("900")})

    created = client.post(
        "/api/monthly-expenses", json=_payload(category_id, date="2026-08-05", amount="8500")
    ).json()
    client.patch(f"/api/monthly-expenses/{created['id']}/status", json={"status": "anulado"})

    body = client.get("/api/summary?month=2026-08").json()
    assert Decimal(body["expenses"]["JPY"]) == Decimal("0")
