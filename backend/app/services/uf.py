"""Servicio de valor de la UF (Unidad de Fomento) en CLP.

Mismo mecanismo que `exchange_rates.py` (D5: cache 1x/día), pero separado
del enum `Currency` (D14 extendido): la UF no es una de las 3 monedas del
alcance, solo se usa para aproximar gastos fijos denominados en UF a su
equivalente en CLP. La fuente es la misma API de tasas ya configurada
(`EXCHANGE_RATE_API_URL`) — el código ISO de la UF es `CLF`.
"""

from __future__ import annotations

import calendar
import os
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import UFRate

API_URL = os.getenv("EXCHANGE_RATE_API_URL", "https://open.er-api.com/v6/latest/USD")
_TIMEOUT = 10.0


class UFRateError(RuntimeError):
    """La API respondió sin los datos necesarios para calcular la UF."""


def _today() -> date:
    return date.today()


def _fetch_uf_value_clp() -> Decimal:
    """1 UF en CLP = (USD→CLP) / (USD→CLF), de la misma respuesta de la API.

    Aislada para poder mockearla en tests (sin red real).
    """
    resp = httpx.get(API_URL, timeout=_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if data.get("result") != "success":
        raise UFRateError(f"result != success: {data.get('result')!r}")

    rates = data.get("rates") or {}
    if "CLP" not in rates or "CLF" not in rates:
        raise UFRateError("faltan CLP o CLF en la respuesta de la API")

    clp = Decimal(str(rates["CLP"]))
    clf = Decimal(str(rates["CLF"]))
    return clp / clf


def get_cached_uf(db: Session, on: date) -> Decimal | None:
    """Valor de la UF cacheado para una fecha, o None si falta."""
    return db.scalar(select(UFRate.value_clp).where(UFRate.date == on))


def get_latest_cached_uf(db: Session) -> tuple[date, Decimal] | None:
    """La cache más reciente (fecha, valor), o None si no hay ninguna."""
    row = db.scalar(select(UFRate).order_by(UFRate.date.desc()).limit(1))
    return (row.date, row.value_clp) if row is not None else None


def _store_uf(db: Session, on: date, value_clp: Decimal) -> None:
    """Upsert del valor del día (reemplaza si ya existía para esa fecha)."""
    db.query(UFRate).filter(UFRate.date == on).delete()
    db.add(UFRate(date=on, value_clp=value_clp))
    db.commit()


def get_daily_uf(db: Session) -> Decimal:
    """Valor de la UF de hoy en CLP.

    Si hay cache del día, la usa (no llama la API). Si no, la trae y cachea.
    Si el fetch falla, cae a la última cache disponible; si tampoco hay,
    propaga.
    """
    today = _today()
    cached = get_cached_uf(db, today)
    if cached is not None:
        return cached

    try:
        value = _fetch_uf_value_clp()
    except (httpx.HTTPError, UFRateError):
        fallback = get_latest_cached_uf(db)
        if fallback is None:
            raise
        return fallback[1]

    _store_uf(db, today, value)
    return value


def payment_date_in_month(payment_day: int, year: int, month: int) -> date:
    """Resuelve `payment_day` (1–31) dentro de un mes calendario concreto,
    recortando al último día si el mes no llega tan lejos (ej. 31 en
    febrero)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(payment_day, last_day))


def get_uf_for_date(db: Session, on: date) -> Decimal:
    """UF a usar para el cobro de un gasto fijo en una fecha concreta
    (`payment_date_in_month`), no la de "hoy".

    La API no da histórico (solo el valor vigente), así que solo se puede
    tener el dato **exacto** de una fecha si la app efectivamente corrió ese
    día y lo cacheó. Si no está esa fecha exacta cacheada (lo más común para
    fechas pasadas no visitadas, o fechas futuras), cae a `get_daily_uf`
    (la mejor disponible ahora) — mismo criterio de aproximación que D1 usa
    para las tasas de cambio.
    """
    exact = get_cached_uf(db, on)
    if exact is not None:
        return exact
    return get_daily_uf(db)
