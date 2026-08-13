"""Tests de transfers CRUD (Task 10).

Foco en D6: `effective_rate = clp_charged / jpy_requested` se calcula en la app,
nunca se ingresa. `jpy_requested = 0` se rechaza (no divide por cero).
"""

from __future__ import annotations

from decimal import Decimal


def _payload(**overrides):
    base = {
        "date": "2026-08-10",
        "jpy_requested": "100000",
        "clp_charged": "650000",
    }
    base.update(overrides)
    return base


def test_lista_vacia_al_inicio(client):
    resp = client.get("/api/transfers")
    assert resp.status_code == 200
    assert resp.json() == []


def test_crea_giro_y_calcula_effective_rate(client):
    resp = client.post("/api/transfers", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] > 0
    # effective_rate = 650000 / 100000 = 6.5
    assert Decimal(body["effective_rate"]) == Decimal("6.5")


def test_effective_rate_se_ignora_si_viene_en_payload(client):
    # El usuario no ingresa la tasa: si la manda, se recalcula igual (D6).
    resp = client.post("/api/transfers", json=_payload(effective_rate="999"))
    assert resp.status_code == 201
    assert Decimal(resp.json()["effective_rate"]) == Decimal("6.5")


def test_effective_rate_redondea_a_seis_decimales(client):
    # 500000 / 70000 = 7.142857142857... → 7.142857
    resp = client.post(
        "/api/transfers", json=_payload(jpy_requested="70000", clp_charged="500000")
    )
    assert resp.status_code == 201
    assert Decimal(resp.json()["effective_rate"]) == Decimal("7.142857")


def test_rechaza_jpy_requested_cero(client):
    resp = client.post("/api/transfers", json=_payload(jpy_requested="0"))
    assert resp.status_code == 422


def test_rechaza_montos_negativos(client):
    assert client.post("/api/transfers", json=_payload(jpy_requested="-1")).status_code == 422
    assert client.post("/api/transfers", json=_payload(clp_charged="-1")).status_code == 422


def test_lista_ordenada_por_fecha_desc(client):
    client.post("/api/transfers", json=_payload(date="2026-07-01"))
    client.post("/api/transfers", json=_payload(date="2026-08-01"))
    listed = client.get("/api/transfers").json()
    assert [t["date"] for t in listed] == ["2026-08-01", "2026-07-01"]
