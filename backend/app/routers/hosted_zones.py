import math

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..bind_utils import export_zone_bind, export_zone_json_string, parse_bind_zone
from ..dns_validation import normalize_record_name
from ..database import get_db
from ..models import DNSRecord, HostedZone, User, generate_id
from ..schemas import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    DNSRecordCreate,
    DNSRecordListResponse,
    DNSRecordResponse,
    DNSRecordUpdate,
    HostedZoneCreate,
    HostedZoneListResponse,
    HostedZoneResponse,
    HostedZoneUpdate,
    ImportZoneRequest,
    ImportZoneResponse,
    MessageResponse,
)

router = APIRouter(prefix="/api/hosted-zones", tags=["hosted-zones"])


def normalize_zone_name(name: str) -> str:
    name = name.strip().lower()
    if not name.endswith("."):
        name += "."
    return name


def normalize_zone_id(zone_id: str) -> str:
    """IDs are stored as /hostedzone/ABC but may arrive as hostedzone/ABC in path URLs."""
    if not zone_id.startswith("/"):
        zone_id = f"/{zone_id}"
    return zone_id


def normalize_record_id(record_id: str) -> str:
    if not record_id.startswith("/"):
        record_id = f"/{record_id}"
    return record_id


def update_record_count(db: Session, zone_id: str) -> None:
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if zone:
        zone.record_count = db.query(DNSRecord).filter(DNSRecord.hosted_zone_id == zone_id).count()
        db.commit()


@router.get("", response_model=HostedZoneListResponse)
def list_hosted_zones(
    search: str = Query("", description="Search by name or ID"),
    type: str = Query("", description="Filter by type: Public or Private"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(HostedZone)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(HostedZone.name.ilike(term), HostedZone.id.ilike(term)))

    if type and type in ("Public", "Private"):
        query = query.filter(HostedZone.type == type)

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(HostedZone.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return HostedZoneListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=HostedZoneResponse, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(
    data: HostedZoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_name = normalize_zone_name(data.name)
    existing = db.query(HostedZone).filter(HostedZone.name == zone_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Hosted zone with this name already exists")

    zone = HostedZone(
        id=generate_id("/hostedzone/"),
        name=zone_name,
        description=data.description,
        comment=data.comment,
        type=data.type,
        private_vpc=data.private_vpc if data.type == "Private" else None,
        record_count=2,
    )
    db.add(zone)
    db.flush()

    ns_value = f"ns-1.awsdns-01.org.\nns-2.awsdns-02.co.uk.\nns-3.awsdns-03.com.\nns-4.awsdns-04.net."
    soa_value = f"ns-1.awsdns-01.org. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"

    db.add(
        DNSRecord(
            id=generate_id("/change/"),
            hosted_zone_id=zone.id,
            name=zone_name,
            type="NS",
            ttl=172800,
            value=ns_value,
        )
    )
    db.add(
        DNSRecord(
            id=generate_id("/change/"),
            hosted_zone_id=zone.id,
            name=zone_name,
            type="SOA",
            ttl=900,
            value=soa_value,
        )
    )
    db.commit()
    db.refresh(zone)
    return zone


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_zones(
    data: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    deleted = 0
    for zone_id in data.ids:
        zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
        if zone:
            db.delete(zone)
            deleted += 1
    db.commit()
    return BulkDeleteResponse(message=f"Deleted {deleted} hosted zone(s)", deleted_count=deleted)


@router.get("/{zone_id:path}/export")
def export_hosted_zone(
    zone_id: str,
    format: str = Query("json", pattern="^(json|bind)$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    records = db.query(DNSRecord).filter(DNSRecord.hosted_zone_id == zone_id).all()

    if format == "bind":
        content = export_zone_bind(zone, records)
        return Response(
            content=content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{zone.name.rstrip(".")}.zone"'},
        )

    return Response(
        content=export_zone_json_string(zone, records),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{zone.name.rstrip(".")}.json"'},
    )


@router.get("/{zone_id:path}", response_model=HostedZoneResponse)
def get_hosted_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone


@router.put("/{zone_id:path}", response_model=HostedZoneResponse)
def update_hosted_zone(
    zone_id: str,
    data: HostedZoneUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    if data.name is not None:
        new_name = normalize_zone_name(data.name)
        if new_name != zone.name:
            existing = db.query(HostedZone).filter(HostedZone.name == new_name).first()
            if existing:
                raise HTTPException(status_code=400, detail="Hosted zone with this name already exists")
            zone.name = new_name

    if data.description is not None:
        zone.description = data.description
    if data.comment is not None:
        zone.comment = data.comment
    if data.type is not None:
        zone.type = data.type
        zone.private_vpc = data.private_vpc if data.type == "Private" else None
    elif data.private_vpc is not None and zone.type == "Private":
        zone.private_vpc = data.private_vpc

    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id:path}", response_model=MessageResponse)
def delete_hosted_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    db.delete(zone)
    db.commit()
    return MessageResponse(message=f"Hosted zone {zone_id} deleted successfully")


# DNS Records endpoints
records_router = APIRouter(prefix="/api/hosted-zones/{zone_id:path}/records", tags=["dns-records"])


@records_router.get("", response_model=DNSRecordListResponse)
def list_records(
    zone_id: str,
    search: str = Query("", description="Search by name or value"),
    type: str = Query("", description="Filter by record type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    query = db.query(DNSRecord).filter(DNSRecord.hosted_zone_id == zone_id)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(DNSRecord.name.ilike(term), DNSRecord.value.ilike(term)))

    if type:
        query = query.filter(DNSRecord.type == type.upper())

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(DNSRecord.name.asc(), DNSRecord.type.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return DNSRecordListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@records_router.post("", response_model=DNSRecordResponse, status_code=status.HTTP_201_CREATED)
def create_record(
    zone_id: str,
    data: DNSRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    record_name = normalize_record_name(data.name, zone.name)

    record = DNSRecord(
        id=generate_id("/change/"),
        hosted_zone_id=zone_id,
        name=record_name,
        type=data.type,
        ttl=data.ttl,
        value=data.value.strip(),
        routing_policy=data.routing_policy,
        set_identifier=data.set_identifier,
        weight=data.weight,
        region=data.region,
        failover=data.failover,
        health_check_id=data.health_check_id,
        alias_target=data.alias_target,
    )
    db.add(record)
    db.commit()
    update_record_count(db, zone_id)
    db.refresh(record)
    return record


@records_router.get("/{record_id:path}", response_model=DNSRecordResponse)
def get_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    record_id = normalize_record_id(record_id)
    record = (
        db.query(DNSRecord)
        .filter(DNSRecord.id == record_id, DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="DNS record not found")
    return record


@records_router.put("/{record_id:path}", response_model=DNSRecordResponse)
def update_record(
    zone_id: str,
    record_id: str,
    data: DNSRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    record_id = normalize_record_id(record_id)
    record = (
        db.query(DNSRecord)
        .filter(DNSRecord.id == record_id, DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="DNS record not found")

    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if data.name is not None and zone:
        record.name = normalize_record_name(data.name, zone.name)
    if data.type is not None:
        record.type = data.type
    if data.ttl is not None:
        record.ttl = data.ttl
    if data.value is not None:
        record.value = data.value.strip()
    if data.routing_policy is not None:
        record.routing_policy = data.routing_policy
    if data.set_identifier is not None:
        record.set_identifier = data.set_identifier
    if data.weight is not None:
        record.weight = data.weight
    if data.region is not None:
        record.region = data.region
    if data.failover is not None:
        record.failover = data.failover
    if data.health_check_id is not None:
        record.health_check_id = data.health_check_id
    if data.alias_target is not None:
        record.alias_target = data.alias_target

    db.commit()
    db.refresh(record)
    return record


@records_router.delete("/{record_id:path}", response_model=MessageResponse)
def delete_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    record_id = normalize_record_id(record_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    record = (
        db.query(DNSRecord)
        .filter(DNSRecord.id == record_id, DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="DNS record not found")

    if zone and record.type in ("NS", "SOA") and record.name == zone.name:
        raise HTTPException(status_code=400, detail="Cannot delete default NS or SOA records for the zone apex")

    db.delete(record)
    db.commit()
    update_record_count(db, zone_id)
    return MessageResponse(message=f"DNS record {record_id} deleted successfully")


@records_router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_records(
    zone_id: str,
    data: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    deleted = 0
    for record_id in data.ids:
        record = (
            db.query(DNSRecord)
            .filter(DNSRecord.id == record_id, DNSRecord.hosted_zone_id == zone_id)
            .first()
        )
        if not record:
            continue
        if record.type in ("NS", "SOA") and record.name == zone.name:
            continue
        db.delete(record)
        deleted += 1

    db.commit()
    update_record_count(db, zone_id)
    return BulkDeleteResponse(message=f"Deleted {deleted} record(s)", deleted_count=deleted)


@records_router.post("/import", response_model=ImportZoneResponse)
def import_records(
    zone_id: str,
    data: ImportZoneRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zone_id = normalize_zone_id(zone_id)
    zone = db.query(HostedZone).filter(HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    parsed = parse_bind_zone(data.content, zone.name)
    imported = 0

    for item in parsed:
        record = DNSRecord(
            id=generate_id("/change/"),
            hosted_zone_id=zone_id,
            name=item["name"],
            type=item["type"],
            ttl=item["ttl"],
            value=item["value"],
        )
        db.add(record)
        imported += 1

    db.commit()
    update_record_count(db, zone_id)
    return ImportZoneResponse(message=f"Imported {imported} record(s)", imported_count=imported)
