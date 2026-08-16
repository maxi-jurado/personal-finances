"""Router de categorías de gasto (monthly_expenses / card_expenses).

CRUD completo. El borrado se bloquea (409) si la categoría está referenciada
por algún gasto — chequeo a nivel de aplicación, ya que SQLite no tiene FK
enforcement activado en este proyecto. Ese chequeo se agrega en la tarea que
introduce la FK `category_id` en los modelos de gasto.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryRead

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=1)


def _require_category(category_id: int, db: Session) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return category


def _require_unique_name(name: str, db: Session, *, exclude_id: int | None = None) -> None:
    query = db.query(Category).filter(Category.name == name)
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre.")


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)) -> Category:
    _require_unique_name(payload.name, db)
    category = Category(name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)
) -> Category:
    category = _require_category(category_id, db)
    _require_unique_name(payload.name, db, exclude_id=category_id)
    category.name = payload.name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)) -> None:
    category = _require_category(category_id, db)
    db.delete(category)
    db.commit()
