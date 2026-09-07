import json
import re
from typing import Any

from .models import DNSRecord, HostedZone


def parse_bind_zone(content: str, zone_name: str) -> list[dict[str, Any]]:
    """Parse a BIND zone file into record dicts (skips existing NS/SOA at apex if present)."""
    records: list[dict[str, Any]] = []
    zone_name = zone_name if zone_name.endswith(".") else f"{zone_name}."

    lines = content.replace("\r\n", "\n").split("\n")
    i = 0
    origin = zone_name

    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line or line.startswith(";"):
            continue
        if line.startswith("$ORIGIN"):
            origin = line.split()[1]
            if not origin.endswith("."):
                origin += "."
            continue
        if line.startswith("$TTL"):
            continue

        # Multi-line record (parentheses)
        while line.endswith("(") and i < len(lines):
            line = line[:-1].strip() + " " + lines[i].strip()
            i += 1
            if ")" in line:
                line = line.replace(")", " ").strip()

        line = re.sub(r"\s+", " ", line)
        line = line.replace('" "', "")

        parts = line.split()
        if len(parts) < 4:
            continue

        idx = 0
        name = parts[idx]
        if name == "@":
            name = origin
        elif not name.endswith("."):
            name = f"{name}.{origin.rstrip('.')}."

        # Optional TTL
        ttl = 300
        if parts[idx + 1].isdigit():
            ttl = int(parts[idx + 1])
            idx += 1

        # Skip class (IN)
        if parts[idx + 1].upper() in ("IN", "CH", "HS"):
            idx += 1

        rtype = parts[idx + 1].upper()
        value = " ".join(parts[idx + 2 :])

        if rtype in ("NS", "SOA") and name == zone_name:
            continue

        if rtype not in ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"):
            continue

        records.append({"name": name, "type": rtype, "ttl": ttl, "value": value.strip()})

    return records


def export_zone_json(zone: HostedZone, records: list[DNSRecord]) -> dict:
    return {
        "hosted_zone": {
            "id": zone.id,
            "name": zone.name,
            "description": zone.description,
            "comment": zone.comment,
            "type": zone.type,
            "private_vpc": zone.private_vpc,
        },
        "records": [
            {
                "name": r.name,
                "type": r.type,
                "ttl": r.ttl,
                "value": r.value,
                "routing_policy": r.routing_policy,
            }
            for r in records
        ],
    }


def export_zone_bind(zone: HostedZone, records: list[DNSRecord]) -> str:
    zone_suffix = zone.name if zone.name.endswith(".") else f"{zone.name}."
    lines = [
        f"; Exported BIND zone file for {zone.name}",
        f"$ORIGIN {zone_suffix}",
        f"$TTL 300",
        "",
    ]
    for r in sorted(records, key=lambda x: (x.name, x.type)):
        rec_name = r.name if r.name.endswith(".") else f"{r.name}."
        if rec_name == zone_suffix:
            rel_name = "@"
        elif rec_name.endswith(f".{zone_suffix}"):
            rel_name = rec_name[: -len(f".{zone_suffix}")]
        elif rec_name.endswith(zone_suffix):
            rel_name = rec_name[: -len(zone_suffix)].rstrip(".") or "@"
        else:
            rel_name = rec_name

        for raw_line in r.value.splitlines():
            val = raw_line.strip()
            if not val:
                continue
            if r.type == "TXT" and not (val.startswith('"') and val.endswith('"')):
                val = f'"{val}"'
            lines.append(f"{rel_name}\t{r.ttl}\tIN\t{r.type}\t{val}")

    return "\n".join(lines) + "\n"


def export_zone_json_string(zone: HostedZone, records: list[DNSRecord]) -> str:
    return json.dumps(export_zone_json(zone, records), indent=2)

