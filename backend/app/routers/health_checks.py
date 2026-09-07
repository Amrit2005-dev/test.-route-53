import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import HealthCheck, User, generate_id
from ..schemas import (
    HealthCheckCreate,
    HealthCheckListResponse,
    HealthCheckResponse,
    HealthCheckUpdate,
    MessageResponse,
)

router = APIRouter(prefix="/api/health-checks", tags=["health-checks"])


@router.get("", response_model=HealthCheckListResponse)
def list_health_checks(
    search: str = Query("", description="Search by name or endpoint"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(HealthCheck)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (HealthCheck.name.ilike(term)) | (HealthCheck.endpoint.ilike(term))
        )

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = (
        query.order_by(HealthCheck.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return HealthCheckListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=HealthCheckResponse, status_code=status.HTTP_201_CREATED)
def create_health_check(
    data: HealthCheckCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    check = HealthCheck(
        id=generate_id("/healthcheck/"),
        name=data.name.strip(),
        endpoint=data.endpoint.strip(),
        protocol=data.protocol,
        port=data.port,
        path=data.path or "/",
        interval_seconds=data.interval_seconds,
        failure_threshold=data.failure_threshold,
        status="Healthy",
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.put("/{check_id:path}", response_model=HealthCheckResponse)
def update_health_check(
    check_id: str,
    data: HealthCheckUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not check_id.startswith("/"):
        check_id = f"/{check_id}"
    check = db.query(HealthCheck).filter(HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")

    for field in ("name", "endpoint", "protocol", "path", "status"):
        value = getattr(data, field, None)
        if value is not None:
            setattr(check, field, value.strip() if isinstance(value, str) else value)
    if data.port is not None:
        check.port = data.port
    if data.interval_seconds is not None:
        check.interval_seconds = data.interval_seconds
    if data.failure_threshold is not None:
        check.failure_threshold = data.failure_threshold

    db.commit()
    db.refresh(check)
    return check


@router.delete("/{check_id:path}", response_model=MessageResponse)
def delete_health_check(
    check_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not check_id.startswith("/"):
        check_id = f"/{check_id}"
    check = db.query(HealthCheck).filter(HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")
    db.delete(check)
    db.commit()
    return MessageResponse(message="Health check deleted")
