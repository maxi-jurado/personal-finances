"""Tests del servicio/endpoint de UF (Unidad de Fomento): cálculo, cache y
fallback — mismo patrón que `test_exchange_rates.py` (D5), pero para D14
extendido (gastos fijos en UF)."""

from datetime import date, timedelta
from decimal import Decimal

import httpx

from app.services import uf


def test_get_daily_uf_fetches_once_then_uses_cache(db, monkeypatch):
    calls = {"n": 0}

    def fake_fetch():
        calls["n"] += 1
        return Decimal("39000")

    monkeypatch.setattr(uf, "_fetch_uf_value_clp", fake_fetch)

    first = uf.get_daily_uf(db)
    second = uf.get_daily_uf(db)

    assert calls["n"] == 1  # la 2ª vez sale de cache, no re-llama la API
    assert first == second == Decimal("39000")


def test_get_daily_uf_falls_back_to_previous_cache_on_failure(db, monkeypatch):
    yesterday = date.today() - timedelta(days=1)
    uf._store_uf(db, yesterday, Decimal("38900"))

    def boom():
        raise httpx.HTTPError("API caída")

    monkeypatch.setattr(uf, "_fetch_uf_value_clp", boom)

    assert uf.get_daily_uf(db) == Decimal("38900")


def test_get_daily_uf_propaga_si_no_hay_cache_ni_fetch(db, monkeypatch):
    def boom():
        raise httpx.HTTPError("API caída")

    monkeypatch.setattr(uf, "_fetch_uf_value_clp", boom)

    try:
        uf.get_daily_uf(db)
        assert False, "debería haber propagado el error"
    except httpx.HTTPError:
        pass


def test_fetch_uf_value_clp_calcula_clp_sobre_clf(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"result": "success", "rates": {"CLP": "800", "CLF": "0.02"}}

    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse())

    # 800 CLP por USD, 0.02 CLF por USD -> 1 CLF = 800/0.02 = 40000 CLP.
    assert uf._fetch_uf_value_clp() == Decimal("800") / Decimal("0.02")


def test_payment_date_in_month_recorta_al_ultimo_dia():
    # Febrero 2026 no es bisiesto: el día 31 se recorta al 28.
    assert uf.payment_date_in_month(31, 2026, 2) == date(2026, 2, 28)
    assert uf.payment_date_in_month(15, 2026, 8) == date(2026, 8, 15)


def test_get_uf_for_date_usa_la_cache_exacta_si_existe(db):
    uf._store_uf(db, date(2026, 8, 5), Decimal("38500"))
    uf._store_uf(db, date(2026, 8, 22), Decimal("39602"))

    assert uf.get_uf_for_date(db, date(2026, 8, 5)) == Decimal("38500")


def test_get_uf_for_date_cae_a_get_daily_uf_si_no_hay_exacta(db, monkeypatch):
    uf._store_uf(db, date.today(), Decimal("39602"))

    # No hay cache para el 1 de enero de 2020; debe caer a la de hoy.
    assert uf.get_uf_for_date(db, date(2020, 1, 1)) == Decimal("39602")


def test_latest_endpoint_returns_cached_uf(client, monkeypatch):
    monkeypatch.setattr(uf, "_fetch_uf_value_clp", lambda: Decimal("39602.35"))

    resp = client.get("/api/uf/latest")

    assert resp.status_code == 200
    body = resp.json()
    assert Decimal(str(body["value_clp"])) == Decimal("39602.35")
    assert body["date"] == date.today().isoformat()
