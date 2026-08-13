"""Router de giros (transfers) CLP → JPY.

D6: el usuario ingresa el JPY que pidió y el CLP total que le cobró el banco;
la app calcula `effective_rate = clp_charged / jpy_requested` (no se ingresa ni
se desglosa comisión aparte). `jpy_requested` debe ser > 0.
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Transfer
from app.schemas import ORMModel

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

# Escala de `effective_rate` (coincide con Numeric(18, 6) del modelo).
_RATE_QUANTUM = Decimal("0.000001")


class TransferCreate(BaseModel):
    date: date_type
    jpy_requested: Decimal = Field(gt=0)
    clp_charged: Decimal = Field(gt=0)
    notes: str | None = None


class TransferRead(ORMModel):
    id: int
    date: date_type
    jpy_requested: Decimal
    clp_charged: Decimal
    effective_rate: Decimal
    notes: str | None = None


@router.get("", response_model=list[TransferRead])
def list_transfers(db: Session = Depends(get_db)) -> list[Transfer]:
    return db.query(Transfer).order_by(Transfer.date.desc(), Transfer.id.desc()).all()


@router.post("", response_model=TransferRead, status_code=201)
def create_transfer(payload: TransferCreate, db: Session = Depends(get_db)) -> Transfer:
    effective_rate = (payload.clp_charged / payload.jpy_requested).quantize(
        _RATE_QUANTUM, rounding=ROUND_HALF_UP
    )
    row = Transfer(
        date=payload.date,
        jpy_requested=payload.jpy_requested,
        clp_charged=payload.clp_charged,
        effective_rate=effective_rate,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
