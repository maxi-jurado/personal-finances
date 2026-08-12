"""Tests del servicio de tipo de cambio: conversión, cache y fallback."""

from datetime import date, timedelta
from decimal import Decimal

import httpx

from app.models import Currency
from app.services import exchange_rates as fx

# Tasas USD-base de prueba: 1 USD = 150 JPY = 900 CLP.
RATES = {
    Currency.USD: Decimal("1"),
    Currency.JPY: Decimal("150"),
    Currency.CLP: Decimal("900"),
}


def test_convert_usd_to_jpy():
    assert fx.convert(Decimal("1"), Currency.USD, Currency.JPY, RATES) == Decimal("150")


def test_convert_jpy_to_usd():
    assert fx.convert(Decimal("150"), Currency.JPY, Currency.USD, RATES) == Decimal("1")


def test_convert_clp_to_jpy():
    # 900 CLP = 1 USD = 150 JPY
    assert fx.convert(Decimal("900"), Currency.CLP, Currency.JPY, RATES) == Decimal("150")


def test_convert_usd_to_clp():
    assert fx.convert(Decimal("1"), Currency.USD, Currency.CLP, RATES) == Decimal("900")


def test_convert_same_currency_is_identity():
    assert fx.convert(Decimal("1234"), Currency.JPY, Currency.JPY, RATES) == Decimal("1234")


def test_get_daily_rates_fetches_once_then_uses_cache(db, monkeypatch):
    calls = {"n": 0}

    def fake_fetch():
        calls["n"] += 1
        return dict(RATES)

    monkeypatch.setattr(fx, "_fetch_usd_rates", fake_fetch)

    first = fx.get_daily_rates(db)
    second = fx.get_daily_rates(db)

    assert calls["n"] == 1  # la 2ª vez sale de cache, no re-llama la API
    assert first == second == RATES


def test_get_daily_rates_falls_back_to_previous_cache_on_failure(db, monkeypatch):
    yesterday = date.today() - timedelta(days=1)
    fx._store_rates(
        db,
        yesterday,
        {Currency.USD: Decimal("1"), Currency.JPY: Decimal("140"), Currency.CLP: Decimal("880")},
    )

    def boom():
        raise httpx.HTTPError("API caída")

    monkeypatch.setattr(fx, "_fetch_usd_rates", boom)

    rates = fx.get_daily_rates(db)
    assert rates[Currency.JPY] == Decimal("140")


def test_latest_endpoint_returns_cached_rates(client, monkeypatch):
    monkeypatch.setattr(fx, "_fetch_usd_rates", lambda: dict(RATES))

    resp = client.get("/api/exchange-rates/latest")

    assert resp.status_code == 200
    body = resp.json()
    assert body["base"] == "USD"
    assert Decimal(str(body["rates"]["JPY"])) == Decimal("150")
    assert Decimal(str(body["rates"]["CLP"])) == Decimal("900")
