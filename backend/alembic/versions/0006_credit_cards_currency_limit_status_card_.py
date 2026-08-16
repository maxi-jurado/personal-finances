"""credit_cards_currency_limit_status_card_expenses_amount

Tarjetas dejan de ser fijas (D17): ganan currency/credit_limit/status.
Filas existentes quedan currency='CLP', credit_limit=0, status='activa' (el
usuario edita el cupo real después). card_expenses.amount_clp se renombra a
`amount` — hereda la moneda de la tarjeta padre en vez de asumir CLP.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-16 19:13:28.075054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'credit_cards',
        sa.Column(
            'currency',
            sa.Enum('CLP', 'JPY', 'USD', name='currency'),
            nullable=False,
            server_default='CLP',
        ),
    )
    op.add_column(
        'credit_cards',
        sa.Column('credit_limit', sa.Numeric(18, 4), nullable=False, server_default='0'),
    )
    op.add_column(
        'credit_cards',
        sa.Column(
            'status',
            sa.Enum('activa', 'desactivada', name='card_status'),
            nullable=False,
            server_default='activa',
        ),
    )

    with op.batch_alter_table('card_expenses', schema=None) as batch_op:
        batch_op.alter_column('amount_clp', new_column_name='amount')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('card_expenses', schema=None) as batch_op:
        batch_op.alter_column('amount', new_column_name='amount_clp')

    with op.batch_alter_table('credit_cards', schema=None) as batch_op:
        batch_op.drop_column('status')
        batch_op.drop_column('credit_limit')
        batch_op.drop_column('currency')
