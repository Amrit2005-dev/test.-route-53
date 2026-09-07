import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .auth import seed_users
from .database import SessionLocal, engine
from .models import DNSRecord, HealthCheck, HostedZone, generate_id
from .routers import auth, health_checks, hosted_zones, stats

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("route53")

ENV = os.getenv("ENV", "development").lower()
IS_PRODUCTION = ENV in ("production", "prod")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def run_migrations() -> None:
    from .database import Base

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured via create_all")



def seed_sample_data(db):
    if db.query(HostedZone).count() > 0:
        return

    zone1 = HostedZone(
        id=generate_id("/hostedzone/"),
        name="example.com.",
        description="Example domain for demo",
        comment="Sample public hosted zone",
        type="Public",
        record_count=10,
    )
    zone2 = HostedZone(
        id=generate_id("/hostedzone/"),
        name="internal.local.",
        description="Internal private zone",
        comment="Private VPC zone",
        type="Private",
        private_vpc="vpc-0a1b2c3d4e5f67890",
        record_count=3,
    )
    db.add_all([zone1, zone2])
    db.flush()

    records = [
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="example.com.", type="NS", ttl=172800, value="ns-1.awsdns-01.org.\nns-2.awsdns-02.co.uk.\nns-3.awsdns-03.com.\nns-4.awsdns-04.net."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="example.com.", type="SOA", ttl=900, value="ns-1.awsdns-01.org. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="example.com.", type="A", ttl=300, value="192.0.2.1"),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="ipv6.example.com.", type="AAAA", ttl=300, value="2001:db8::1"),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="www.example.com.", type="CNAME", ttl=300, value="example.com."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="example.com.", type="TXT", ttl=300, value='"v=spf1 include:_spf.google.com ~all"'),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="mail.example.com.", type="MX", ttl=300, value="10 mail.example.com."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="ptr.example.com.", type="PTR", ttl=300, value="host.example.com."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="_sip._tcp.example.com.", type="SRV", ttl=300, value="10 60 5060 bigbox.example.com."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone1.id, name="example.com.", type="CAA", ttl=300, value='0 issue "letsencrypt.org"'),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone2.id, name="internal.local.", type="NS", ttl=172800, value="ns-1.awsdns-01.org.\nns-2.awsdns-02.co.uk."),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone2.id, name="internal.local.", type="SOA", ttl=900, value="ns-1.awsdns-01.org. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"),
        DNSRecord(id=generate_id("/change/"), hosted_zone_id=zone2.id, name="api.internal.local.", type="A", ttl=60, value="10.0.1.50"),
    ]
    db.add_all(records)
    db.commit()
    logger.info("Seeded sample hosted zones and records")


def seed_health_checks(db):
    if db.query(HealthCheck).count() > 0:
        return
    checks = [
        HealthCheck(
            id=generate_id("/healthcheck/"),
            name="example.com homepage",
            endpoint="example.com",
            protocol="HTTPS",
            port=443,
            path="/",
            interval_seconds=30,
            failure_threshold=3,
            status="Healthy",
        ),
        HealthCheck(
            id=generate_id("/healthcheck/"),
            name="api.internal.local",
            endpoint="10.0.1.50",
            protocol="HTTP",
            port=80,
            path="/health",
            interval_seconds=10,
            failure_threshold=2,
            status="Healthy",
        ),
        HealthCheck(
            id=generate_id("/healthcheck/"),
            name="mail.example.com SMTP",
            endpoint="mail.example.com",
            protocol="TCP",
            port=25,
            path=None,
            interval_seconds=60,
            failure_threshold=3,
            status="Pending",
        ),
    ]
    db.add_all(checks)
    db.commit()
    logger.info("Seeded sample health checks")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        run_migrations()
        db = SessionLocal()
        try:
            seed_users(db)
            seed_sample_data(db)
            seed_health_checks(db)
        finally:
            db.close()
    except Exception:
        logger.exception("Startup initialization failed")
    logger.info("Route53 API started (env=%s)", ENV)
    yield
    logger.info("Route53 API shutting down")


app = FastAPI(
    title="Route53 Clone API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION and os.getenv("ENABLE_DOCS", "").lower() not in ("1", "true", "yes") else "/docs",
    redoc_url=None if IS_PRODUCTION and os.getenv("ENABLE_DOCS", "").lower() not in ("1", "true", "yes") else "/redoc",
    openapi_url=None if IS_PRODUCTION and os.getenv("ENABLE_DOCS", "").lower() not in ("1", "true", "yes") else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stats.router)
app.include_router(health_checks.router)
app.include_router(hosted_zones.records_router)
app.include_router(hosted_zones.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "env": ENV}


@app.get("/api/health/ready")
def readiness():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
