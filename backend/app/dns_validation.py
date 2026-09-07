import ipaddress
import re

FQDN_RE = re.compile(
    r"^(?:@|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.?)$",
    re.IGNORECASE,
)


def validate_record_value(record_type: str, value: str, alias_target: bool = False) -> None:
    if alias_target:
        return
    value = value.strip()
    if not value:
        raise ValueError("Record value is required")

    rtype = record_type.upper()

    if rtype == "A":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            lines = value.split()
        for part in lines:
            for ip_str in part.split():
                try:
                    ipaddress.IPv4Address(ip_str)
                except ValueError:
                    raise ValueError(f"Invalid IPv4 address: {ip_str}")

    elif rtype == "AAAA":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            lines = value.split()
        for part in lines:
            for ip_str in part.split():
                try:
                    ipaddress.IPv6Address(ip_str)
                except ValueError:
                    raise ValueError(f"Invalid IPv6 address: {ip_str}")

    elif rtype == "CNAME":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            raise ValueError("CNAME value is required")
        if len(lines) > 1:
            raise ValueError("CNAME records can only have a single target value")
        target = lines[0].rstrip(".")
        if not FQDN_RE.match(target):
            raise ValueError("CNAME value must be a valid hostname (e.g. example.com.)")

    elif rtype in ("NS", "PTR"):
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            raise ValueError(f"{rtype} value is required")
        for line in lines:
            target = line.rstrip(".")
            if not FQDN_RE.match(target):
                raise ValueError(f"{rtype} value must be a valid hostname")

    elif rtype == "MX":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            raise ValueError("MX value is required")
        for line in lines:
            parts = line.split()
            if len(parts) != 2:
                raise ValueError("MX records require priority and hostname (e.g. 10 mail.example.com.)")
            try:
                p = int(parts[0])
            except ValueError:
                raise ValueError("MX priority must be an integer (e.g. 10)")
            if not (0 <= p <= 65535):
                raise ValueError("MX priority must be between 0 and 65535")
            if not FQDN_RE.match(parts[1].rstrip(".")):
                raise ValueError("MX hostname must be valid (e.g. mail.example.com.)")

    elif rtype == "SRV":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            raise ValueError("SRV value is required")
        for line in lines:
            parts = line.split()
            if len(parts) != 4:
                raise ValueError("SRV records require priority, weight, port, and target (e.g. 10 60 5060 bigbox.example.com.)")
            try:
                p, w, port = int(parts[0]), int(parts[1]), int(parts[2])
            except ValueError:
                raise ValueError("SRV priority, weight, and port must be valid integers")
            if not (0 <= p <= 65535 and 0 <= w <= 65535 and 0 <= port <= 65535):
                raise ValueError("SRV priority, weight, and port must be numbers between 0 and 65535")
            if not FQDN_RE.match(parts[3].rstrip(".")):
                raise ValueError("SRV target must be a valid hostname")

    elif rtype == "CAA":
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if not lines:
            raise ValueError("CAA value is required")
        for line in lines:
            parts = line.split(maxsplit=2)
            if len(parts) < 3:
                raise ValueError('CAA records require flags, tag, and value (e.g. 0 issue "letsencrypt.org")')
            try:
                flag = int(parts[0])
            except ValueError:
                raise ValueError("CAA flag must be an integer between 0 and 255")
            if not (0 <= flag <= 255):
                raise ValueError("CAA flag must be an integer between 0 and 255")
            tag = parts[1].lower()
            if tag not in ("issue", "issuewild", "iodef"):
                raise ValueError('CAA tag must be "issue", "issuewild", or "iodef"')
            val_part = parts[2].strip()
            if not val_part:
                raise ValueError("CAA value cannot be empty")

    elif rtype == "TXT":
        if len(value) > 4096:
            raise ValueError("TXT value too long (max 4096 characters)")

    elif rtype == "SOA":
        parts = value.split()
        if len(parts) < 7:
            raise ValueError("SOA records require MNAME, RNAME, SERIAL, REFRESH, RETRY, EXPIRE, MINIMUM")


def normalize_record_name(name: str, zone_name: str) -> str:
    record_name = name.strip()
    if record_name in ("@", ""):
        return zone_name if zone_name.endswith(".") else f"{zone_name}."
    if not record_name.endswith("."):
        zone_base = zone_name.rstrip(".")
        if record_name == zone_base or record_name.endswith(f".{zone_base}"):
            record_name = f"{record_name}."
        else:
            record_name = f"{record_name}.{zone_name}" if not record_name.endswith(zone_name) else record_name
            if not record_name.endswith("."):
                record_name += "."
    return record_name
