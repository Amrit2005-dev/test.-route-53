"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import { useRequireAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { HealthCheck } from "@/lib/types";

const STATUS_TYPE: Record<string, "success" | "error" | "pending"> = {
  Healthy: "success",
  Unhealthy: "error",
  Pending: "pending",
};

export default function HealthChecksPage() {
  const auth = useRequireAuth();
  const { notify } = useNotification();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    endpoint: "",
    protocol: "HTTPS" as "HTTP" | "HTTPS" | "TCP",
    port: "443",
    path: "/",
    interval_seconds: "30",
  });

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listHealthChecks({ search: search || undefined, page, page_size: 10 });
      setChecks(data.items);
      setTotalPages(data.total_pages);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      notify("error", "Failed to load health checks", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [search, page, notify]);

  useEffect(() => {
    if (auth.loading || !auth.user) return;
    const t = setTimeout(fetchChecks, 300);
    return () => clearTimeout(t);
  }, [fetchChecks, auth.loading, auth.user]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await api.createHealthCheck({
        name: form.name,
        endpoint: form.endpoint,
        protocol: form.protocol,
        port: Number(form.port),
        path: form.path,
        interval_seconds: Number(form.interval_seconds),
      });
      notify("success", "Health check created");
      setCreateOpen(false);
      fetchChecks();
    } catch (err) {
      notify("error", "Create failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (check: HealthCheck) => {
    try {
      await api.deleteHealthCheck(check.id);
      notify("success", "Health check deleted");
      fetchChecks();
    } catch (err) {
      notify("error", "Delete failed", err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Monitor endpoint health for DNS routing and failover."
        actions={
          <Button variant="primary" iconName="add-plus" onClick={() => setCreateOpen(true)}>
            Create health check
          </Button>
        }
      >
        Health checks
      </Header>

      <Table
        loading={loading}
        loadingText="Loading health checks"
        columnDefinitions={[
          { id: "name", header: "Name", cell: (item) => item.name },
          { id: "endpoint", header: "Endpoint", cell: (item) => `${item.protocol}://${item.endpoint}:${item.port}${item.path || ""}` },
          { id: "interval", header: "Interval", cell: (item) => `${item.interval_seconds}s` },
          {
            id: "status",
            header: "Status",
            cell: (item) => <StatusIndicator type={STATUS_TYPE[item.status] || "info"}>{item.status}</StatusIndicator>,
          },
          { id: "created", header: "Created", cell: (item) => formatDate(item.created_at) },
          {
            id: "actions",
            header: "Actions",
            cell: (item) => (
              <Button variant="inline-link" onClick={() => handleDelete(item)}>Delete</Button>
            ),
          },
        ]}
        items={checks}
        trackBy="id"
        filter={
          <Input
            type="search"
            value={search}
            onChange={({ detail }) => { setSearch(detail.value); setPage(1); }}
            placeholder="Filter by name or endpoint"
          />
        }
        pagination={
          <Pagination currentPageIndex={page} pagesCount={totalPages} onChange={({ detail }) => setPage(detail.currentPageIndex)} />
        }
        empty={<Box textAlign="center"><b>No health checks</b><Box variant="p">Create a health check to monitor endpoints.</Box></Box>}
      />

      <Modal
        visible={createOpen}
        onDismiss={() => setCreateOpen(false)}
        header="Create health check"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={submitting} onClick={handleCreate}>Create</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Name"><Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} /></FormField>
          <FormField label="Endpoint"><Input value={form.endpoint} onChange={({ detail }) => setForm({ ...form, endpoint: detail.value })} placeholder="example.com" /></FormField>
          <FormField label="Protocol">
            <Select
              selectedOption={{ label: form.protocol, value: form.protocol }}
              onChange={({ detail }) => setForm({ ...form, protocol: detail.selectedOption.value as typeof form.protocol })}
              options={[{ label: "HTTPS", value: "HTTPS" }, { label: "HTTP", value: "HTTP" }, { label: "TCP", value: "TCP" }]}
            />
          </FormField>
          <FormField label="Port"><Input type="number" value={form.port} onChange={({ detail }) => setForm({ ...form, port: detail.value })} /></FormField>
          <FormField label="Path"><Input value={form.path} onChange={({ detail }) => setForm({ ...form, path: detail.value })} /></FormField>
          <FormField label="Interval (seconds)"><Input type="number" value={form.interval_seconds} onChange={({ detail }) => setForm({ ...form, interval_seconds: detail.value })} /></FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
