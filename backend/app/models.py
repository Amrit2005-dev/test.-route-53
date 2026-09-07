import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def generate_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12].upper()}"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(200), nullable=False)
    account_id = Column(String(20), nullable=False, default="123456789012")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False, index=True)

    user = relationship("User")

    __table_args__ = (Index("ix_sessions_user_expires", "user_id", "expires_at"),)


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id = Column(String(20), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)
    type = Column(String(20), nullable=False, default="Public", index=True)
    record_count = Column(Integer, default=0)
    private_vpc = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    records = relationship("DNSRecord", back_populates="hosted_zone", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hosted_zones_type_created", "type", "created_at"),
        Index("ix_hosted_zones_name_type", "name", "type"),
    )


class DNSRecord(Base):
    __tablename__ = "dns_records"

    id = Column(String(20), primary_key=True, index=True)
    hosted_zone_id = Column(String(20), ForeignKey("hosted_zones.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(10), nullable=False, index=True)
    ttl = Column(Integer, nullable=False, default=300)
    value = Column(Text, nullable=False)
    routing_policy = Column(String(50), nullable=False, default="Simple")
    set_identifier = Column(String(100), nullable=True)
    weight = Column(Integer, nullable=True)
    region = Column(String(50), nullable=True)
    failover = Column(String(20), nullable=True)
    health_check_id = Column(String(50), nullable=True)
    alias_target = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    hosted_zone = relationship("HostedZone", back_populates="records")

    __table_args__ = (
        Index("ix_dns_records_zone_name", "hosted_zone_id", "name"),
        Index("ix_dns_records_zone_type", "hosted_zone_id", "type"),
        Index("ix_dns_records_zone_name_type", "hosted_zone_id", "name", "type"),
    )


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id = Column(String(20), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    endpoint = Column(String(512), nullable=False)
    protocol = Column(String(10), nullable=False, default="HTTPS")
    port = Column(Integer, nullable=False, default=443)
    path = Column(String(255), nullable=True, default="/")
    interval_seconds = Column(Integer, nullable=False, default=30)
    failure_threshold = Column(Integer, nullable=False, default=3)
    status = Column(String(20), nullable=False, default="Healthy", index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
