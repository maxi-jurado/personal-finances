"""uf_rates_fixed_expenses_uf_amount

D14 extendido: gastos fijos denominados en UF (Unidad de Fomento). Nueva
tabla `uf_rates` (mismo patrón que `exchange_rates`, D5, pero separada del
enum `Currency` — la UF no es una de las 3 monedas del alcance). En
`fixed_expenses`, `amount` pasa a ser nullable y se agrega `uf_amount`: un
gasto en UF guarda solo la cantidad de UF, no un monto en CLP fijo — el
equivalente se calcula al vuelo con la UF cacheada del día (ver
`app/services/uf.py`).

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-22 17:04:10.633729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'uf_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('value_clp', sa.Numeric(precision=20, scale=10), nullable=False),
        sa.Column('fetched_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('uf_rates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_uf_rates_date'), ['date'], unique=True)

    with op.batch_alter_table('fixed_expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uf_amount', sa.Numeric(precision=18, scale=4), nullable=True))
        batch_op.alter_column(
            'amount',
            existing_type=sa.NUMERIC(precision=18, scale=4),
            nullable=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('fixed_expenses', schema=None) as batch_op:
        batch_op.alter_column(
            'amount',
            existing_type=sa.NUMERIC(precision=18, scale=4),
            nullable=False,
        )
        batch_op.drop_column('uf_amount')

    with op.batch_alter_table('uf_rates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_uf_rates_date'))

    op.drop_table('uf_rates')
