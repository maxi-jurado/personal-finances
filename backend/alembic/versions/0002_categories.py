"""categories

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-16 18:53:01.731612

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set inicial de categorías (D16). "Gustos Personales" cubre lo que el
# usuario llamaba informalmente "vicios" (tabaco y similares).
_SEED_CATEGORIES = [
    "Alimentación",
    "Entretenimiento",
    "Estilo de Vida",
    "Gustos Personales",
    "Aseo y Limpieza",
    "Transporte",
    "Salud",
    "Vivienda y Servicios",
]


def upgrade() -> None:
    """Upgrade schema."""
    categories_table = op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.bulk_insert(
        categories_table,
        [{"name": name} for name in _SEED_CATEGORIES],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('categories')
