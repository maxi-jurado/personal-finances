"""Servicio de tipo de cambio.

Trae las tasas USD-base desde `open.er-api.com`, las cachea 1x/día en la tabla
`exchange_rates` (D5) y expone `convert()` para las 3 conversiones del alcance
(CLP↔JPY, USD↔JPY, USD↔CLP). Todo en `Decimal` (D4).
"""

from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Currency, ExchangeRate

API_URL = os.getenv("EXCHANGE_RATE_API_URL", "https://open.er-api.com/v6/latest/USD")
BASE = Currency.USD
_TIMEOUT = 10.0


class ExchangeRateError(RuntimeError):
    """La API respondió con un formato inesperado o incompleto."""


def _today() -> date:
    return date.today()


def _fetch_usd_rates() -> dict[Currency, Decimal]:
    """Llama la API externa y devuelve las tasas USD-base para las 3 monedas.

    Aislada para poder mockearla en tests (sin red real).
    """
    resp = httpx.get(API_URL, timeout=_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if data.get("result") != "success":
        raise ExchangeRateError(f"result != success: {data.get('result')!r}")

    rates = data.get("rates") or {}
    out: dict[Currency, Decimal] = {}
    for cur in Currency:
        if cur.value not in rates:
            raise ExchangeRateError(f"falta tasa para {cur.value}")
        # str() evita heredar el error binario de un float intermedio.
        out[cur] = Decimal(str(rates[cur.value]))
    return out


def get_cached_rates(db: Session, on: date) -> dict[Currency, Decimal] | None:
    """Tasas USD-base cacheadas para una fecha, o None si faltan (in)completas."""
    rows = db.scalars(
        select(ExchangeRate).where(
            ExchangeRate.date == on, ExchangeRate.base_currency == BASE
        )
    ).all()
    mapping = {r.target_currency: r.rate for r in rows}
    if not all(cur in mapping for cur in Currency):
        return None
    return mapping


def get_latest_cached(db: Session) -> tuple[date, dict[Currency, Decimal]] | None:
    """La cache completa más reciente (fecha, tasas), o None si no hay ninguna."""
    latest_date = db.scalar(
        select(ExchangeRate.date)
        .where(ExchangeRate.base_currency == BASE)
        .order_by(ExchangeRate.date.desc())
        .limit(1)
    )
    if latest_date is None:
        return None
    mapping = get_cached_rates(db, latest_date)
    return (latest_date, mapping) if mapping is not None else None


def _store_rates(db: Session, on: date, rates: dict[Currency, Decimal]) -> None:
    """Upsert de las tasas del día (reemplaza si ya existían para esa fecha)."""
    db.query(ExchangeRate).filter(
        ExchangeRate.date == on, ExchangeRate.base_currency == BASE
    ).delete()
    for target, rate in rates.items():
        db.add(
            ExchangeRate(date=on, base_currency=BASE, target_currency=target, rate=rate)
        )
    db.commit()


def get_daily_rates(db: Session) -> dict[Currency, Decimal]:
    """Tasas USD-base de hoy.

    Si hay cache del día, la usa (no llama la API). Si no, la trae y cachea. Si
    el fetch falla, cae a la última cache disponible; si tampoco hay, propaga.
    """
    today = _today()
    cached = get_cached_rates(db, today)
    if cached is not None:
        return cached

    try:
        rates = _fetch_usd_rates()
    except (httpx.HTTPError, ExchangeRateError):
        fallback = get_latest_cached(db)
        if fallback is None:
            raise
        return fallback[1]

    _store_rates(db, today, rates)
    return rates


def convert(
    amount: Decimal, src: Currency, dst: Currency, rates: dict[Currency, Decimal]
) -> Decimal:
    """Convierte `amount` de `src` a `dst` usando tasas USD-base.

    amount(src) → USD (÷ rate[src]) → dst (× rate[dst]).
    """
    if src == dst:
        return Decimal(amount)
    return Decimal(amount) / rates[src] * rates[dst]
