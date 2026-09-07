export interface User {
  id: number;
  username: string;
  display_name: string;
  account_id: string;
}

export interface HostedZone {
  id: string;
  name: string;
  description: string | null;
  comment: string | null;
  type: "Public" | "Private";
  record_count: number;
  private_vpc: string | null;
  created_at: string;
  updated_at: string;
}

export interface DNSRecord {
  id: string;
  hosted_zone_id: string;
  name: string;
  type: string;
  ttl: number;
  value: string;
  routing_policy: string;
  set_identifier: string | null;
  weight: number | null;
  region: string | null;
  failover: string | null;
  health_check_id: string | null;
  alias_target: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type RecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "PTR" | "SRV" | "CAA";

export const RECORD_TYPES: RecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"];

export type RoutingPolicy = "Simple" | "Weighted" | "Failover" | "Geolocation";

export interface DashboardStats {
  hosted_zone_count: number;
  record_count: number;
  health_check_count: number;
  recent_activity: { title: string; detail: string; time: string }[];
}

export interface HealthCheck {
  id: string;
  name: string;
  endpoint: string;
  protocol: "HTTP" | "HTTPS" | "TCP";
  port: number;
  path: string | null;
  interval_seconds: number;
  failure_threshold: number;
  status: "Healthy" | "Unhealthy" | "Pending";
  created_at: string;
  updated_at: string;
}
