"""Add health_checks table

Revision ID: 002
Revises: 001
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa

revision = "002_health_checks"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "health_checks",
        sa.Column("id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("endpoint", sa.String(length=512), nullable=False),
        sa.Column("protocol", sa.String(length=10), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=True),
        sa.Column("interval_seconds", sa.Integer(), nullable=False),
        sa.Column("failure_threshold", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_health_checks_name", "health_checks", ["name"])
    op.create_index("ix_health_checks_status", "health_checks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_health_checks_status", table_name="health_checks")
    op.drop_index("ix_health_checks_name", table_name="health_checks")
    op.drop_table("health_checks")
