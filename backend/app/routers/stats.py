from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DNSRecord, HealthCheck, HostedZone, User
from ..schemas import DashboardStatsResponse, RecentActivityItem

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    zones = db.query(HostedZone).order_by(HostedZone.updated_at.desc()).limit(5).all()
    record_count = db.query(DNSRecord).count()
    health_check_count = db.query(HealthCheck).count()

    activity: list[RecentActivityItem] = []
    for zone in zones:
        latest = (
            db.query(DNSRecord)
            .filter(DNSRecord.hosted_zone_id == zone.id)
            .order_by(DNSRecord.updated_at.desc())
            .first()
        )
        if latest:
            activity.append(
                RecentActivityItem(
                    title=zone.name,
                    detail=f"{latest.type} record updated for {latest.name}",
                    time=latest.updated_at.isoformat() if isinstance(latest.updated_at, datetime) else str(latest.updated_at),
                )
            )
        else:
            activity.append(
                RecentActivityItem(
                    title=zone.name,
                    detail=zone.description or "Hosted zone configured",
                    time=zone.updated_at.isoformat() if isinstance(zone.updated_at, datetime) else str(zone.updated_at),
                )
            )

    return DashboardStatsResponse(
        hosted_zone_count=db.query(HostedZone).count(),
        record_count=record_count,
        health_check_count=health_check_count,
        recent_activity=activity[:5],
    )
