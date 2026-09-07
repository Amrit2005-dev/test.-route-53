from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from .dns_validation import validate_record_value

RECORD_TYPES = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]
ZONE_TYPES = Literal["Public", "Private"]
ROUTING_POLICIES = Literal["Simple", "Weighted", "Failover", "Geolocation"]
HEALTH_PROTOCOLS = Literal["HTTP", "HTTPS", "TCP"]
HEALTH_STATUSES = Literal["Healthy", "Unhealthy", "Pending"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    account_id: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    session_id: str


class HostedZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    comment: Optional[str] = None
    type: ZONE_TYPES = "Public"
    private_vpc: Optional[str] = None

    @model_validator(mode="after")
    def validate_private_vpc(self):
        if self.type == "Private" and not (self.private_vpc and self.private_vpc.strip()):
            raise ValueError("VPC ID is required for private hosted zones")
        return self


class HostedZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    comment: Optional[str] = None
    type: Optional[ZONE_TYPES] = None
    private_vpc: Optional[str] = None


class HostedZoneResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    comment: Optional[str]
    type: str
    record_count: int
    private_vpc: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HostedZoneListResponse(BaseModel):
    items: list[HostedZoneResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DNSRecordCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: RECORD_TYPES
    ttl: int = Field(300, ge=0, le=2147483647)
    value: str = Field(..., min_length=1)
    routing_policy: ROUTING_POLICIES = "Simple"
    set_identifier: Optional[str] = None
    weight: Optional[int] = Field(None, ge=0, le=255)
    region: Optional[str] = None
    failover: Optional[str] = None
    health_check_id: Optional[str] = None
    alias_target: bool = False

    @model_validator(mode="after")
    def validate_record(self):
        validate_record_value(self.type, self.value, self.alias_target)
        if self.routing_policy == "Weighted" and self.weight is None:
            raise ValueError("Weight is required for weighted routing")
        if self.routing_policy == "Failover" and not self.failover:
            raise ValueError("Failover type is required for failover routing")
        return self


class DNSRecordUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[RECORD_TYPES] = None
    ttl: Optional[int] = Field(None, ge=0, le=2147483647)
    value: Optional[str] = Field(None, min_length=1)
    routing_policy: Optional[ROUTING_POLICIES] = None
    set_identifier: Optional[str] = None
    weight: Optional[int] = Field(None, ge=0, le=255)
    region: Optional[str] = None
    failover: Optional[str] = None
    health_check_id: Optional[str] = None
    alias_target: Optional[bool] = None

    @model_validator(mode="after")
    def validate_record(self):
        if self.type and self.value:
            validate_record_value(self.type, self.value, bool(self.alias_target))
        return self


class DNSRecordResponse(BaseModel):
    id: str
    hosted_zone_id: str
    name: str
    type: str
    ttl: int
    value: str
    routing_policy: str
    set_identifier: Optional[str]
    weight: Optional[int]
    region: Optional[str]
    failover: Optional[str]
    health_check_id: Optional[str]
    alias_target: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DNSRecordListResponse(BaseModel):
    items: list[DNSRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseModel):
    message: str


class BulkDeleteRequest(BaseModel):
    ids: list[str] = Field(..., min_length=1)


class BulkDeleteResponse(BaseModel):
    message: str
    deleted_count: int


class ImportZoneRequest(BaseModel):
    content: str = Field(..., min_length=1)
    format: Literal["bind"] = "bind"


class ImportZoneResponse(BaseModel):
    message: str
    imported_count: int


class RecentActivityItem(BaseModel):
    title: str
    detail: str
    time: str


class DashboardStatsResponse(BaseModel):
    hosted_zone_count: int
    record_count: int
    health_check_count: int
    recent_activity: list[RecentActivityItem]


class HealthCheckCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    endpoint: str = Field(..., min_length=1, max_length=512)
    protocol: HEALTH_PROTOCOLS = "HTTPS"
    port: int = Field(443, ge=1, le=65535)
    path: Optional[str] = "/"
    interval_seconds: int = Field(30, ge=10, le=3600)
    failure_threshold: int = Field(3, ge=1, le=10)


class HealthCheckUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    endpoint: Optional[str] = Field(None, min_length=1, max_length=512)
    protocol: Optional[HEALTH_PROTOCOLS] = None
    port: Optional[int] = Field(None, ge=1, le=65535)
    path: Optional[str] = None
    interval_seconds: Optional[int] = Field(None, ge=10, le=3600)
    failure_threshold: Optional[int] = Field(None, ge=1, le=10)
    status: Optional[HEALTH_STATUSES] = None


class HealthCheckResponse(BaseModel):
    id: str
    name: str
    endpoint: str
    protocol: str
    port: int
    path: Optional[str]
    interval_seconds: int
    failure_threshold: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HealthCheckListResponse(BaseModel):
    items: list[HealthCheckResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
