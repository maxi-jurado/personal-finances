"""monthly_expenses_status

Agrega `status` (pagado/anulado, D15). Default 'pagado' vía server_default,
así que las filas existentes quedan como pagadas sin backfill manual.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-16 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'monthly_expenses',
        sa.Column(
            'status',
            sa.Enum('pagado', 'anulado', name='expense_status'),
            nullable=False,
            server_default='pagado',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('monthly_expenses', schema=None) as batch_op:
        batch_op.drop_column('status')
