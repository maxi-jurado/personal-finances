"""Schemas Pydantic compartidos.

Los schemas por entidad (income, transfers, etc.) se agregan en sus tareas.
Aquí vive lo transversal: el enum `Currency` reexportado y una base ORM.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models import Currency  # reexport para el resto de los schemas

__all__ = ["Currency", "ORMModel", "ConfigCreate", "ConfigStatus", "CategoryRead"]

# Orden canónico para derivar la moneda base cuando el wizard no la especifica.
_CURRENCY_ORDER = (Currency.CLP, Currency.JPY, Currency.USD)


class ORMModel(BaseModel):
    """Base para schemas de lectura que se construyen desde modelos ORM."""

    model_config = ConfigDict(from_attributes=True)


class ConfigCreate(BaseModel):
    """Payload del wizard: monedas principales (≥2) y moneda base opcional."""

    currencies: list[Currency]
    base_currency: Currency | None = None

    @field_validator("currencies")
    @classmethod
    def _at_least_two_unique(cls, value: list[Currency]) -> list[Currency]:
        unique = list(dict.fromkeys(value))  # dedup preservando orden
        if len(unique) < 2:
            raise ValueError("Selecciona al menos 2 monedas distintas.")
        return unique

    @model_validator(mode="after")
    def _resolve_base_currency(self) -> "ConfigCreate":
        if self.base_currency is None:
            self.base_currency = next(c for c in _CURRENCY_ORDER if c in self.currencies)
        elif self.base_currency not in self.currencies:
            raise ValueError("La moneda base debe estar entre las seleccionadas.")
        return self


class ConfigStatus(BaseModel):
    """Estado de configuración que consume el frontend."""

    configured: bool
    currencies: list[Currency] | None = None
    base_currency: Currency | None = None


class CategoryRead(ORMModel):
    """Reexportado: lo usan categories.py y los Read de monthly/card expenses."""

    id: int
    name: str
