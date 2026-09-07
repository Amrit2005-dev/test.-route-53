"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useRequireAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const auth = useRequireAuth();
  const router = useRouter();
  const { notify } = useNotification();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.getStats());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      notify("error", "Failed to load dashboard", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (auth.loading || !auth.user) return;
    load();
  }, [auth.loading, auth.user, load]);

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Operational overview of your Route 53 DNS environment."
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button iconName="refresh" loading={loading} onClick={load}>
              Refresh
            </Button>
            <Button variant="primary" iconName="add-plus" onClick={() => router.push("/hosted-zones")}>
              Hosted zones
            </Button>
          </SpaceBetween>
        }
      >
        Dashboard
      </Header>

      <ColumnLayout columns={3} variant="text-grid">
        <Container header={<Header variant="h2">Hosted zones</Header>}>
          <Box variant="awsui-value-large">{stats?.hosted_zone_count ?? "—"}</Box>
          <Box color="text-body-secondary">Active domains</Box>
        </Container>
        <Container header={<Header variant="h2">DNS records</Header>}>
          <Box variant="awsui-value-large">{stats?.record_count ?? "—"}</Box>
          <Box color="text-body-secondary">Across all zones</Box>
        </Container>
        <Container header={<Header variant="h2">Health checks</Header>}>
          <Box variant="awsui-value-large">{stats?.health_check_count ?? "—"}</Box>
          <Box color="text-body-secondary">
            <Link href="/health-checks" onFollow={(e) => { e.preventDefault(); router.push("/health-checks"); }}>
              View checks
            </Link>
          </Box>
        </Container>
      </ColumnLayout>

      <ColumnLayout columns={2}>
        <Container header={<Header variant="h2" counter={stats ? `(${stats.recent_activity.length})` : undefined}>Recent activity</Header>}>
          {loading && !stats ? (
            <StatusIndicator type="loading">Loading activity</StatusIndicator>
          ) : (
            <SpaceBetween size="s">
              {(stats?.recent_activity || []).map((item) => (
                <Box key={`${item.title}-${item.time}`} padding="s">
                  <Box fontWeight="bold">{item.title}</Box>
                  <Box color="text-body-secondary">{item.detail}</Box>
                  <Box fontSize="body-s" color="text-body-secondary">{formatDate(item.time)}</Box>
                </Box>
              ))}
              {stats?.recent_activity.length === 0 && (
                <Box color="text-body-secondary">No recent activity.</Box>
              )}
            </SpaceBetween>
          )}
        </Container>

        <Container header={<Header variant="h2">Quick actions</Header>}>
          <SpaceBetween size="xs">
            <Button iconName="add-plus" onClick={() => router.push("/hosted-zones")}>Create hosted zone</Button>
            <Button iconName="upload" onClick={() => router.push("/hosted-zones")}>Import DNS records</Button>
            <Button iconName="status-positive" onClick={() => router.push("/health-checks")}>Health checks</Button>
          </SpaceBetween>
        </Container>
      </ColumnLayout>
    </SpaceBetween>
  );
}
