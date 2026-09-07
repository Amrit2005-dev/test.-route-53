import pytest
from app.dns_validation import validate_record_value, normalize_record_name
from app.bind_utils import parse_bind_zone, export_zone_bind
from app.models import DNSRecord, HostedZone


def test_validate_a_records():
    # Valid single and multi-line IPv4
    validate_record_value("A", "192.0.2.1")
    validate_record_value("A", "192.0.2.1\n198.51.100.2\n203.0.113.5")
    validate_record_value("A", "192.0.2.1 198.51.100.2")

    # Invalid IPv4
    with pytest.raises(ValueError):
        validate_record_value("A", "999.999.999.999")
    with pytest.raises(ValueError):
        validate_record_value("A", "not-an-ip")
    with pytest.raises(ValueError):
        validate_record_value("A", "192.0.2.1\ninvalid-ip")


def test_validate_aaaa_records():
    # Valid single and multi-line IPv6
    validate_record_value("AAAA", "2001:0db8:85a3:0000:0000:8a2e:0370:7334")
    validate_record_value("AAAA", "2001:db8::1\n2001:db8::2")
    validate_record_value("AAAA", "::1")

    # Invalid IPv6
    with pytest.raises(ValueError):
        validate_record_value("AAAA", "192.0.2.1")
    with pytest.raises(ValueError):
        validate_record_value("AAAA", "2001:xyz::1")


def test_validate_cname_records():
    # Valid CNAME
    validate_record_value("CNAME", "example.com.")
    validate_record_value("CNAME", "sub.domain.co.uk")

    # Multiple targets not allowed for CNAME
    with pytest.raises(ValueError, match="single target"):
        validate_record_value("CNAME", "target1.com.\ntarget2.com.")

    # Invalid hostname
    with pytest.raises(ValueError):
        validate_record_value("CNAME", "bad hostname with spaces.com")


def test_validate_txt_records():
    # Valid TXT
    validate_record_value("TXT", '"v=spf1 include:_spf.google.com ~all"')
    validate_record_value("TXT", "google-site-verification=abcdef123456")
    validate_record_value("TXT", '"line 1"\n"line 2"')

    # Over 4096 chars
    with pytest.raises(ValueError, match="too long"):
        validate_record_value("TXT", "a" * 4097)


def test_validate_mx_records():
    # Valid MX
    validate_record_value("MX", "10 mail.example.com.")
    validate_record_value("MX", "10 mail1.example.com.\n20 mail2.example.com.")

    # Invalid priority
    with pytest.raises(ValueError, match="between 0 and 65535"):
        validate_record_value("MX", "70000 mail.example.com.")
    with pytest.raises(ValueError, match="integer"):
        validate_record_value("MX", "ten mail.example.com.")

    # Missing hostname
    with pytest.raises(ValueError, match="priority and hostname"):
        validate_record_value("MX", "10")

    # Invalid hostname
    with pytest.raises(ValueError, match="hostname must be valid"):
        validate_record_value("MX", "10 invalid!@#mail.com")


def test_validate_ns_records():
    # Valid NS
    validate_record_value("NS", "ns-1.awsdns-01.org.")
    validate_record_value("NS", "ns-1.awsdns-01.org.\nns-2.awsdns-02.co.uk.")

    # Invalid NS hostname
    with pytest.raises(ValueError):
        validate_record_value("NS", "invalid!@#nshost")


def test_validate_ptr_records():
    # Valid PTR
    validate_record_value("PTR", "server1.example.com.")
    validate_record_value("PTR", "host.example.com.\nbackup.example.com.")

    # Invalid PTR hostname
    with pytest.raises(ValueError):
        validate_record_value("PTR", "invalid!@#ptrhost")


def test_validate_srv_records():
    # Valid SRV: priority weight port target
    validate_record_value("SRV", "10 60 5060 bigbox.example.com.")
    validate_record_value("SRV", "0 5 5060 sip1.example.com.\n10 10 5060 sip2.example.com.")

    # Missing components
    with pytest.raises(ValueError, match="require priority, weight, port, and target"):
        validate_record_value("SRV", "10 60 5060")

    # Out-of-bounds port / priority / weight
    with pytest.raises(ValueError, match="between 0 and 65535"):
        validate_record_value("SRV", "10 60 70000 bigbox.example.com.")
    with pytest.raises(ValueError, match="valid integers"):
        validate_record_value("SRV", "ten 60 5060 bigbox.example.com.")

    # Invalid target
    with pytest.raises(ValueError, match="valid hostname"):
        validate_record_value("SRV", "10 60 5060 invalid!@#target.com")


def test_validate_caa_records():
    # Valid CAA: flags tag value
    validate_record_value("CAA", '0 issue "letsencrypt.org"')
    validate_record_value("CAA", '0 issuewild "digicert.com"')
    validate_record_value("CAA", '0 iodef "mailto:security@example.com"')
    validate_record_value("CAA", '0 issue "letsencrypt.org"\n0 iodef "mailto:security@example.com"')

    # Invalid flag
    with pytest.raises(ValueError, match="between 0 and 255"):
        validate_record_value("CAA", '300 issue "letsencrypt.org"')
    with pytest.raises(ValueError, match="integer between 0 and 255"):
        validate_record_value("CAA", 'zero issue "letsencrypt.org"')

    # Invalid tag
    with pytest.raises(ValueError, match='CAA tag must be'):
        validate_record_value("CAA", '0 invalidtag "letsencrypt.org"')

    # Missing components
    with pytest.raises(ValueError, match="require flags, tag, and value"):
        validate_record_value("CAA", "0 issue")


def test_api_crud_all_record_types(client, auth_cookies):
    # Create test zone
    z_res = client.post(
        "/api/hosted-zones",
        json={"name": "test-records-suite.com", "type": "Public", "description": "Test all record types"},
        cookies=auth_cookies,
    )
    assert z_res.status_code == 201
    zone_id = z_res.json()["id"].lstrip("/")

    record_payloads = [
        {"name": "test-records-suite.com.", "type": "A", "ttl": 300, "value": "192.0.2.1\n198.51.100.2"},
        {"name": "ipv6.test-records-suite.com.", "type": "AAAA", "ttl": 300, "value": "2001:db8::1"},
        {"name": "www.test-records-suite.com.", "type": "CNAME", "ttl": 300, "value": "test-records-suite.com."},
        {"name": "test-records-suite.com.", "type": "TXT", "ttl": 300, "value": '"v=spf1 ~all"'},
        {"name": "mail.test-records-suite.com.", "type": "MX", "ttl": 300, "value": "10 mail1.example.com.\n20 mail2.example.com."},
        {"name": "sub.test-records-suite.com.", "type": "NS", "ttl": 300, "value": "ns1.customns.com.\nns2.customns.com."},
        {"name": "ptr.test-records-suite.com.", "type": "PTR", "ttl": 300, "value": "host.example.com."},
        {"name": "_sip._tcp.test-records-suite.com.", "type": "SRV", "ttl": 300, "value": "10 60 5060 bigbox.example.com."},
        {"name": "test-records-suite.com.", "type": "CAA", "ttl": 300, "value": '0 issue "letsencrypt.org"'},
    ]

    created_ids = []
    for payload in record_payloads:
        res = client.post(f"/api/hosted-zones/{zone_id}/records", json=payload, cookies=auth_cookies)
        assert res.status_code == 201, f"Failed for {payload['type']}: {res.text}"
        data = res.json()
        assert data["type"] == payload["type"]
        created_ids.append(data["id"].lstrip("/"))

    # List and filter by each record type
    for payload in record_payloads:
        rtype = payload["type"]
        res = client.get(f"/api/hosted-zones/{zone_id}/records?type={rtype}", cookies=auth_cookies)
        assert res.status_code == 200
        items = res.json()["items"]
        assert len(items) >= 1
        assert any(item["type"] == rtype for item in items)

    # Export zone in BIND format
    export_res = client.get(f"/api/hosted-zones/{zone_id}/export?format=bind", cookies=auth_cookies)
    assert export_res.status_code == 200
    bind_text = export_res.text
    for rtype in ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]:
        assert f"IN\t{rtype}" in bind_text

    # Cleanup zone
    client.delete(f"/api/hosted-zones/{zone_id}", cookies=auth_cookies)


def test_bind_parse_and_export_all_types():
    bind_content = """
$ORIGIN example.com.
$TTL 300
@       IN  A       192.0.2.1
@       IN  A       198.51.100.2
ipv6    IN  AAAA    2001:db8::1
www     IN  CNAME   example.com.
@       IN  TXT     "v=spf1 include:_spf.google.com ~all"
@       IN  MX      10 mail.example.com.
@       IN  CAA     0 issue "letsencrypt.org"
_sip._tcp   IN  SRV 10 60 5060 sipserver.example.com.
ptr     IN  PTR     server1.example.com.
sub     IN  NS      ns1.subdomain.com.
"""
    parsed = parse_bind_zone(bind_content, "example.com.")
    types_found = {item["type"] for item in parsed}
    expected_types = {"A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV", "PTR", "NS"}
    assert expected_types.issubset(types_found)
