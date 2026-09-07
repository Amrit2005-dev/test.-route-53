def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readiness(client):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_login_invalid(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert response.status_code == 401


def test_list_hosted_zones(client, auth_cookies):
    response = client.get("/api/hosted-zones", cookies=auth_cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


def test_get_zone_and_records(client, auth_cookies):
    zones = client.get("/api/hosted-zones", cookies=auth_cookies).json()["items"]
    zone_id = zones[0]["id"].lstrip("/")

    zone = client.get(f"/api/hosted-zones/{zone_id}", cookies=auth_cookies)
    assert zone.status_code == 200

    records = client.get(f"/api/hosted-zones/{zone_id}/records", cookies=auth_cookies)
    assert records.status_code == 200
    assert records.json()["total"] >= 1


def test_create_zone_requires_private_vpc(client, auth_cookies):
    response = client.post(
        "/api/hosted-zones",
        json={"name": "bad.private.", "type": "Private"},
        cookies=auth_cookies,
    )
    assert response.status_code == 422


def test_create_zone_and_delegation_ns(client, auth_cookies):
    response = client.post(
        "/api/hosted-zones",
        json={"name": "pytest-demo.com", "type": "Public", "description": "test"},
        cookies=auth_cookies,
    )
    assert response.status_code == 201
    zone = response.json()
    zone_id = zone["id"].lstrip("/")

    records = client.get(f"/api/hosted-zones/{zone_id}/records?type=NS", cookies=auth_cookies).json()
    assert records["total"] >= 1

    delete = client.delete(f"/api/hosted-zones/{zone_id}", cookies=auth_cookies)
    assert delete.status_code == 200


def test_record_validation(client, auth_cookies):
    zones = client.get("/api/hosted-zones", cookies=auth_cookies).json()["items"]
    zone_id = zones[0]["id"].lstrip("/")

    bad = client.post(
        f"/api/hosted-zones/{zone_id}/records",
        json={"name": "bad", "type": "A", "ttl": 300, "value": "not-an-ip"},
        cookies=auth_cookies,
    )
    assert bad.status_code == 422


def test_dashboard_stats(client, auth_cookies):
    response = client.get("/api/stats", cookies=auth_cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["hosted_zone_count"] >= 1
    assert data["record_count"] >= 1


def test_health_checks(client, auth_cookies):
    response = client.get("/api/health-checks", cookies=auth_cookies)
    assert response.status_code == 200
    assert response.json()["total"] >= 1
