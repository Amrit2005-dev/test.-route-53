"""initial schema with indexes

Revision ID: 001_initial
Revises:
Create Date: 2026-06-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("account_id", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"])
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])
    op.create_index("ix_sessions_user_expires", "sessions", ["user_id", "expires_at"])

    op.create_table(
        "hosted_zones",
        sa.Column("id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=True),
        sa.Column("private_vpc", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hosted_zones_id", "hosted_zones", ["id"])
    op.create_index("ix_hosted_zones_name", "hosted_zones", ["name"])
    op.create_index("ix_hosted_zones_type", "hosted_zones", ["type"])
    op.create_index("ix_hosted_zones_created_at", "hosted_zones", ["created_at"])
    op.create_index("ix_hosted_zones_type_created", "hosted_zones", ["type", "created_at"])
    op.create_index("ix_hosted_zones_name_type", "hosted_zones", ["name", "type"])

    op.create_table(
        "dns_records",
        sa.Column("id", sa.String(length=20), nullable=False),
        sa.Column("hosted_zone_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("routing_policy", sa.String(length=50), nullable=False),
        sa.Column("set_identifier", sa.String(length=100), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("region", sa.String(length=50), nullable=True),
        sa.Column("failover", sa.String(length=20), nullable=True),
        sa.Column("health_check_id", sa.String(length=50), nullable=True),
        sa.Column("alias_target", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["hosted_zone_id"], ["hosted_zones.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dns_records_id", "dns_records", ["id"])
    op.create_index("ix_dns_records_hosted_zone_id", "dns_records", ["hosted_zone_id"])
    op.create_index("ix_dns_records_name", "dns_records", ["name"])
    op.create_index("ix_dns_records_type", "dns_records", ["type"])
    op.create_index("ix_dns_records_zone_name", "dns_records", ["hosted_zone_id", "name"])
    op.create_index("ix_dns_records_zone_type", "dns_records", ["hosted_zone_id", "type"])
    op.create_index("ix_dns_records_zone_name_type", "dns_records", ["hosted_zone_id", "name", "type"])


def downgrade() -> None:
    op.drop_table("dns_records")
    op.drop_table("hosted_zones")
    op.drop_table("sessions")
    op.drop_table("users")
