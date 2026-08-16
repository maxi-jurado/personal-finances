"""monthly_expenses_category_fk

Reemplaza el texto libre `category` por `category_id` (FK a `categories`).
Backfill: cada valor de texto distinto se busca o se crea como Category,
antes de dropear la columna vieja (D16).

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-16 18:54:52.351371

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import column, table


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    op.add_column('monthly_expenses', sa.Column('category_id', sa.Integer(), nullable=True))

    categories_t = table('categories', column('id', sa.Integer), column('name', sa.String))
    monthly_t = table(
        'monthly_expenses',
        column('category', sa.String),
        column('category_id', sa.Integer),
    )

    names = [
        row[0]
        for row in bind.execute(sa.select(monthly_t.c.category).distinct())
    ]
    for name in names:
        category_id = bind.execute(
            sa.select(categories_t.c.id).where(categories_t.c.name == name)
        ).scalar()
        if category_id is None:
            bind.execute(categories_t.insert().values(name=name))
            category_id = bind.execute(
                sa.select(categories_t.c.id).where(categories_t.c.name == name)
            ).scalar()
        bind.execute(
            monthly_t.update()
            .where(monthly_t.c.category == name)
            .values(category_id=category_id)
        )

    with op.batch_alter_table('monthly_expenses', schema=None) as batch_op:
        batch_op.alter_column('category_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('category')
        batch_op.create_foreign_key(
            'fk_monthly_expenses_category_id_categories', 'categories', ['category_id'], ['id']
        )
        batch_op.create_index(
            batch_op.f('ix_monthly_expenses_category_id'), ['category_id'], unique=False
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    op.add_column('monthly_expenses', sa.Column('category', sa.String(), nullable=True))

    categories_t = table('categories', column('id', sa.Integer), column('name', sa.String))
    monthly_t = table(
        'monthly_expenses',
        column('category', sa.String),
        column('category_id', sa.Integer),
    )
    rows = bind.execute(sa.select(categories_t.c.id, categories_t.c.name)).all()
    for category_id, name in rows:
        bind.execute(
            monthly_t.update()
            .where(monthly_t.c.category_id == category_id)
            .values(category=name)
        )

    with op.batch_alter_table('monthly_expenses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_monthly_expenses_category_id'))
        batch_op.alter_column('category', existing_type=sa.String(), nullable=False)
        batch_op.drop_column('category_id')
