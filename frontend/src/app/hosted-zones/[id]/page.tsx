"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Textarea from "@cloudscape-design/components/textarea";
import { useRequireAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { api, ApiError } from "@/lib/api";
import { downloadBlob } from "@/lib/format";
import { fromPagePathId } from "@/lib/paths";
import type { DNSRecord, HostedZone, RecordType, RoutingPolicy } from "@/lib/types";
import { RECORD_TYPES } from "@/lib/types";

const RECORD_TYPE_CONFIG: Record<
  RecordType,
  { summary: string; description: string; placeholder: string }
> = {
  A: {
    summary: "IPv4 address",
    description: "Routes traffic to IPv4 addresses. Enter multiple IP addresses on separate lines for round-robin routing.",
    placeholder: "192.0.2.1\n198.51.100.2",
  },
  AAAA: {
    summary: "IPv6 address",
    description: "Routes traffic to IPv6 addresses in colon-separated format. Enter multiple addresses on separate lines.",
    placeholder: "2001:0db8:85a3:0000:0000:8a2e:0370:7334\n2001:db8::1",
  },
  CNAME: {
    summary: "Canonical name",
    description: "Routes traffic to another domain name or hostname.",
    placeholder: "example.com.",
  },
  TXT: {
    summary: "Text record",
    description: "Holds verification tokens, SPF, or text data. Enclose values in double quotation marks.",
    placeholder: '"v=spf1 include:_spf.google.com ~all"',
  },
  MX: {
    summary: "Mail exchange",
    description: "Specifies mail servers with priority (0-65535) and hostname (e.g. 10 mail.example.com.).",
    placeholder: "10 mail.example.com.\n20 backup.example.com.",
  },
  NS: {
    summary: "Name server",
    description: "Delegates a DNS zone to use authoritative name servers.",
    placeholder: "ns-1.awsdns-01.org.\nns-2.awsdns-02.co.uk.",
  },
  PTR: {
    summary: "Pointer record",
    description: "Domain name pointer used for reverse DNS resolution.",
    placeholder: "server1.example.com.",
  },
  SRV: {
    summary: "Service locator",
    description: "Service record: Priority, Weight, Port, and Target host separated by spaces.",
    placeholder: "10 60 5060 bigbox.example.com.",
  },
  CAA: {
    summary: "Certificate Authority Authorization",
    description: "Specifies allowed CAs: Flag (0-255), Tag (issue | issuewild | iodef), and CA domain/value.",
    placeholder: '0 issue "letsencrypt.org"\n0 iodef "mailto:security@example.com"',
  },
};

const RECORD_TYPE_OPTIONS = RECORD_TYPES.map((t) => ({
  label: `${t} – ${RECORD_TYPE_CONFIG[t]?.summary || t}`,
  value: t,
}));

const ROUTING_OPTIONS: { label: string; value: RoutingPolicy }[] = [
  { label: "Simple", value: "Simple" },
  { label: "Weighted", value: "Weighted" },
  { label: "Failover", value: "Failover" },
  { label: "Geolocation", value: "Geolocation" },
];

export default function HostedZoneDetailPage() {
  const auth = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const zoneId = fromPagePathId(params.id as string);
  const { notify } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [zoneError, setZoneError] = useState(false);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<{ label: string; value: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<DNSRecord[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DNSRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; value?: string; ttl?: string; weight?: string; failover?: string }>({});
  const [form, setForm] = useState({
    name: "",
    type: "A" as RecordType,
    ttl: "300",
    value: "",
    routing_policy: "Simple" as RoutingPolicy,
    weight: "",
    failover: "",
    alias_target: false,
  });

  const fetchZone = useCallback(async () => {
    try {
      setZone(await api.getHostedZone(zoneId));
      setZoneError(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setZoneError(true);
      notify("error", "Failed to load zone", err instanceof ApiError ? err.message : undefined);
      router.push("/hosted-zones");
    }
  }, [zoneId, notify, router]);

  const fetchRecords = useCallback(async () => {
    if (zoneError) return;
    setLoading(true);
    try {
      const data = await api.listRecords(zoneId, {
        search: search || undefined,
        type: typeFilter?.value || undefined,
        page,
        page_size: 20,
      });
      setRecords(data.items);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setSelected([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      notify("error", "Failed to load records", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [zoneId, search, typeFilter, page, zoneError, notify]);

  useEffect(() => {
    if (auth.loading || !auth.user) return;
    fetchZone();
  }, [fetchZone, auth.loading, auth.user]);

  useEffect(() => {
    if (auth.loading || !auth.user || zoneError || !zone) return;
    const t = setTimeout(fetchRecords, 300);
    return () => clearTimeout(t);
  }, [fetchRecords, auth.loading, auth.user, zoneError, zone]);

  useEffect(() => {
    const handler = () => { setErrors({}); setCreateOpen(true); };
    window.addEventListener("route53:create", handler);
    return () => window.removeEventListener("route53:create", handler);
  }, []);

  useEffect(() => {
    setErrors({});
    if (editRecord) {
      const rel = editRecord.name === zone?.name ? "@" : editRecord.name.replace(`.${zone?.name}`, "").replace(zone?.name || "", "");
      setForm({
        name: rel,
        type: editRecord.type as RecordType,
        ttl: String(editRecord.ttl),
        value: editRecord.value,
        routing_policy: (editRecord.routing_policy as RoutingPolicy) || "Simple",
        weight: editRecord.weight != null ? String(editRecord.weight) : "",
        failover: editRecord.failover || "",
        alias_target: editRecord.alias_target,
      });
    } else if (!createOpen) {
      setForm({ name: "", type: "A", ttl: "300", value: "", routing_policy: "Simple", weight: "", failover: "", alias_target: false });
    }
  }, [editRecord, createOpen, zone?.name]);

  const refresh = () => {
    fetchZone();
    fetchRecords();
  };

  const handleExport = async (format: "json" | "bind") => {
    try {
      const content = await api.exportHostedZone(zoneId, format);
      downloadBlob(content, `${zone?.name.replace(/\.$/, "")}.${format === "bind" ? "zone" : "json"}`, format === "bind" ? "text/plain" : "application/json");
      notify("success", "Export complete");
    } catch (err) {
      notify("error", "Export failed", err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleImport = async (file: File) => {
    setSubmitting(true);
    try {
      const result = await api.importRecords(zoneId, await file.text());
      notify("success", result.message);
      refresh();
    } catch (err) {
      notify("error", "Import failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRecord = async () => {
    const fieldErrors: { name?: string; value?: string; ttl?: string; weight?: string; failover?: string } = {};

    if (!form.value || !form.value.trim()) {
      fieldErrors.value = "Value is required. Please enter an IP address, domain, or record content.";
    }
    if (!form.alias_target && (!form.ttl || isNaN(Number(form.ttl)) || Number(form.ttl) < 0)) {
      fieldErrors.ttl = "TTL must be a valid positive integer.";
    }
    if (form.routing_policy === "Weighted" && (form.weight === "" || isNaN(Number(form.weight)) || Number(form.weight) < 0 || Number(form.weight) > 255)) {
      fieldErrors.weight = "Weight must be an integer between 0 and 255.";
    }
    if (form.routing_policy === "Failover" && !form.failover) {
      fieldErrors.failover = "Failover type is required (Primary or Secondary).";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      notify("error", "Validation error", fieldErrors.value || Object.values(fieldErrors)[0]);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name: form.name || "@",
        type: form.type,
        ttl: Number(form.ttl),
        value: form.value.trim(),
        routing_policy: form.routing_policy,
        weight: form.routing_policy === "Weighted" && form.weight ? Number(form.weight) : null,
        failover: form.routing_policy === "Failover" ? form.failover || null : null,
        alias_target: form.alias_target,
      };
      if (editRecord) await api.updateRecord(zoneId, editRecord.id, payload);
      else await api.createRecord(zoneId, payload);
      notify("success", editRecord ? "Record updated" : "Record created");
      setCreateOpen(false);
      setEditRecord(null);
      refresh();
    } catch (err) {
      notify("error", "Save failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await api.bulkDeleteRecords(zoneId, selected.map((r) => r.id));
      notify("success", `Deleted ${selected.length} record(s)`);
      setDeleteOpen(false);
      refresh();
    } catch (err) {
      notify("error", "Delete failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (!zone && !zoneError) {
    return (
      <Box textAlign="center" padding="xxl">
        <StatusIndicator type="loading">Loading hosted zone...</StatusIndicator>
      </Box>
    );
  }

  if (!zone) return null;

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description={zone.description || `Hosted zone ID: ${zone.id}`}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            {selected.length > 0 && <Button iconName="remove" onClick={() => setDeleteOpen(true)}>Delete ({selected.length})</Button>}
            <Button onClick={() => handleExport("json")} iconName="download">Export JSON</Button>
            <Button onClick={() => handleExport("bind")} iconName="download">Export BIND</Button>
            <Button onClick={() => fileRef.current?.click()} iconName="upload">Import BIND</Button>
            <input ref={fileRef} type="file" accept=".zone,.txt,.bind" hidden onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
            <Button variant="primary" iconName="add-plus" onClick={() => setCreateOpen(true)}>Create record</Button>
          </SpaceBetween>
        }
      >
        <Link href="/hosted-zones" onFollow={(e) => { e.preventDefault(); router.push("/hosted-zones"); }}>Hosted zones</Link>
        {" / "}
        {zone.name}
      </Header>

      <ColumnLayout columns={4} variant="text-grid">
        <Container header={<Header variant="h2">Type</Header>}><StatusIndicator type={zone.type === "Public" ? "info" : "success"}>{zone.type}</StatusIndicator></Container>
        <Container header={<Header variant="h2">Record count</Header>}>{zone.record_count}</Container>
        <Container header={<Header variant="h2">Comment</Header>}>{zone.comment || "—"}</Container>
        <Container header={<Header variant="h2">VPC</Header>}>{zone.private_vpc || "—"}</Container>
      </ColumnLayout>

      <Table
        loading={loading}
        loadingText="Loading records"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        columnDefinitions={[
          { id: "name", header: "Record name", cell: (item) => item.name, sortingField: "name" },
          { id: "type", header: "Type", cell: (item) => <Box variant="code">{item.type}</Box> },
          {
            id: "policy",
            header: "Routing policy",
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <span>{item.routing_policy}</span>
                {item.alias_target && <StatusIndicator type="info">Alias</StatusIndicator>}
              </SpaceBetween>
            ),
          },
          { id: "value", header: "Value / Route traffic to", cell: (item) => <Box variant="code" fontSize="body-s"><span style={{ whiteSpace: "pre-wrap" }}>{item.value}</span></Box> },
          { id: "ttl", header: "TTL", cell: (item) => item.ttl },
          { id: "actions", header: "Actions", cell: (item) => <Button variant="inline-link" onClick={() => setEditRecord(item)}>Edit</Button> },
        ]}
        items={records}
        trackBy="id"
        pagination={<Pagination currentPageIndex={page} pagesCount={totalPages} onChange={({ detail }) => setPage(detail.currentPageIndex)} />}
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <Input type="search" value={search} onChange={({ detail }) => { setSearch(detail.value); setPage(1); }} placeholder="Filter records" />
            <Select
              selectedOption={typeFilter}
              onChange={({ detail }) => { setTypeFilter(detail.selectedOption as { label: string; value: string }); setPage(1); }}
              placeholder="All types"
              options={[{ label: "All types", value: "" }, ...RECORD_TYPE_OPTIONS, { label: "SOA", value: "SOA" }]}
            />
            {(search || typeFilter?.value) && <Button onClick={() => { setSearch(""); setTypeFilter(null); setPage(1); }}>Clear</Button>}
          </SpaceBetween>
        }
        header={<Header counter={`(${total})`} actions={<Button iconName="refresh" onClick={fetchRecords} />}>Records</Header>}
        empty={<Box textAlign="center"><b>No records</b><Box variant="p">Create or import records to get started.</Box></Box>}
      />

      <Modal visible={createOpen || !!editRecord} onDismiss={() => { setCreateOpen(false); setEditRecord(null); }} header={editRecord ? "Edit record" : "Create record"} footer={
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => { setCreateOpen(false); setEditRecord(null); }}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleSaveRecord}>Save</Button>
        </SpaceBetween></Box>
      }>
        <SpaceBetween size="m">
          <FormField label="Record name" description={`Use @ for apex (${zone.name})`}>
            <Input value={form.name} onChange={({ detail }) => setForm({ ...form, name: detail.value })} placeholder="@" />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Type" description={RECORD_TYPE_CONFIG[form.type]?.summary}>
              <Select
                selectedOption={{ label: `${form.type} – ${RECORD_TYPE_CONFIG[form.type]?.summary || form.type}`, value: form.type }}
                onChange={({ detail }) => setForm({ ...form, type: detail.selectedOption.value as RecordType })}
                options={RECORD_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label="TTL (seconds)" errorText={errors.ttl}>
              <Input
                type="number"
                value={form.ttl}
                onChange={({ detail }) => {
                  setForm({ ...form, ttl: detail.value });
                  if (errors.ttl) setErrors((prev) => ({ ...prev, ttl: undefined }));
                }}
                disabled={form.alias_target}
              />
            </FormField>
          </ColumnLayout>
          <FormField label="Routing policy">
            <Select
              selectedOption={{ label: form.routing_policy, value: form.routing_policy }}
              onChange={({ detail }) => setForm({ ...form, routing_policy: detail.selectedOption.value as RoutingPolicy })}
              options={ROUTING_OPTIONS}
            />
          </FormField>
          {form.routing_policy === "Weighted" && (
            <FormField label="Weight" errorText={errors.weight}>
              <Input
                type="number"
                value={form.weight}
                onChange={({ detail }) => {
                  setForm({ ...form, weight: detail.value });
                  if (errors.weight) setErrors((prev) => ({ ...prev, weight: undefined }));
                }}
                placeholder="0 - 255"
              />
            </FormField>
          )}
          {form.routing_policy === "Failover" && (
            <FormField label="Failover type" errorText={errors.failover}>
              <Select
                selectedOption={{ label: form.failover || "Primary", value: form.failover || "PRIMARY" }}
                onChange={({ detail }) => {
                  setForm({ ...form, failover: detail.selectedOption.value || "" });
                  if (errors.failover) setErrors((prev) => ({ ...prev, failover: undefined }));
                }}
                options={[{ label: "Primary", value: "PRIMARY" }, { label: "Secondary", value: "SECONDARY" }]}
              />
            </FormField>
          )}
          <Checkbox checked={form.alias_target} onChange={({ detail }) => setForm({ ...form, alias_target: detail.checked })}>
            Alias record
          </Checkbox>
          <FormField
            label="Value / Route traffic to"
            errorText={errors.value}
            description={
              form.alias_target
                ? "Choose an alias target (e.g. AWS resource domain or Route 53 record name)."
                : RECORD_TYPE_CONFIG[form.type]?.description || "Enter the DNS record value"
            }
          >
            <Textarea
              value={form.value}
              onChange={({ detail }) => {
                setForm({ ...form, value: detail.value });
                if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
              }}
              rows={4}
              placeholder={
                form.alias_target
                  ? "dualstack.my-loadbalancer-123.us-east-1.elb.amazonaws.com."
                  : RECORD_TYPE_CONFIG[form.type]?.placeholder || "192.0.2.1"
              }
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      <Modal visible={deleteOpen} onDismiss={() => setDeleteOpen(false)} header="Delete records" footer={
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleDelete}>Delete</Button>
        </SpaceBetween></Box>
      }>
        Delete {selected.length} record(s)? NS/SOA apex records are skipped automatically.
      </Modal>
    </SpaceBetween>
  );
}
