"""Schemas Pydantic compartidos.

Los schemas por entidad (income, transfers, etc.) se agregan en sus tareas.
Aquí vive lo transversal: el enum `Currency` reexportado y una base ORM.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.models import Currency  # reexport para el resto de los schemas

__all__ = ["Currency", "ORMModel"]


class ORMModel(BaseModel):
    """Base para schemas de lectura que se construyen desde modelos ORM."""

    model_config = ConfigDict(from_attributes=True)
