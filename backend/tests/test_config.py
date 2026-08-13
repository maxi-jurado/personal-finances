"""Tests del flujo de config/wizard (Task 5).

Cubre: DB fresca sin config, validación de monedas (≥2, solo CLP/JPY/USD),
persistencia idempotente (no se puede reconfigurar) y derivación de la moneda
base.
"""

from __future__ import annotations


def test_get_config_sin_config(client):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    assert resp.json() == {"configured": False, "currencies": None, "base_currency": None}


def test_post_config_valida_minimo_dos_monedas(client):
    resp = client.post("/api/config", json={"currencies": ["CLP"]})
    assert resp.status_code == 422


def test_post_config_rechaza_moneda_no_soportada(client):
    resp = client.post("/api/config", json={"currencies": ["CLP", "EUR"]})
    assert resp.status_code == 422


def test_post_config_persiste_y_deriva_base(client):
    resp = client.post("/api/config", json={"currencies": ["JPY", "USD"]})
    assert resp.status_code == 201
    body = resp.json()
    assert body["configured"] is True
    assert body["currencies"] == ["JPY", "USD"]
    # Orden canónico [CLP, JPY, USD]: la primera seleccionada es JPY.
    assert body["base_currency"] == "JPY"


def test_get_config_tras_post_refleja_estado(client):
    client.post("/api/config", json={"currencies": ["CLP", "USD"]})
    resp = client.get("/api/config")
    body = resp.json()
    assert body["configured"] is True
    assert body["currencies"] == ["CLP", "USD"]
    assert body["base_currency"] == "CLP"


def test_post_config_duplica_dedup_y_valida(client):
    # Con duplicados quedan <2 monedas únicas → inválido.
    resp = client.post("/api/config", json={"currencies": ["CLP", "CLP"]})
    assert resp.status_code == 422


def test_post_config_base_explicita_debe_estar_seleccionada(client):
    resp = client.post(
        "/api/config",
        json={"currencies": ["CLP", "JPY"], "base_currency": "USD"},
    )
    assert resp.status_code == 422


def test_post_config_no_reconfigura(client):
    assert client.post("/api/config", json={"currencies": ["CLP", "JPY"]}).status_code == 201
    resp = client.post("/api/config", json={"currencies": ["USD", "JPY"]})
    assert resp.status_code == 409
