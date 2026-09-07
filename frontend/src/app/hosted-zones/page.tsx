"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
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
import { copyToClipboard, formatDate, truncateId } from "@/lib/format";
import { toPagePathId } from "@/lib/paths";
import type { DNSRecord, HostedZone } from "@/lib/types";

function ZoneFormFields({
  values,
  onChange,
  errors,
  setErrors,
}: {
  values: { name: string; description: string; comment: string; type: "Public" | "Private"; private_vpc: string };
  onChange: (v: typeof values) => void;
  errors?: { name?: string; private_vpc?: string };
  setErrors?: (fn: (prev: { name?: string; private_vpc?: string }) => { name?: string; private_vpc?: string }) => void;
}) {
  return (
    <SpaceBetween size="m">
      <FormField label="Domain name" errorText={errors?.name} description="Specify a fully qualified domain name (e.g. example.com or app.internal).">
        <Input
          value={values.name}
          onChange={({ detail }) => {
            onChange({ ...values, name: detail.value });
            if (errors?.name && setErrors) setErrors((p) => ({ ...p, name: undefined }));
          }}
          placeholder="example.com"
        />
      </FormField>
      <FormField label="Description">
        <Input value={values.description} onChange={({ detail }) => onChange({ ...values, description: detail.value })} placeholder="Production public hosted zone" />
      </FormField>
      <FormField label="Comment">
        <Textarea value={values.comment} onChange={({ detail }) => onChange({ ...values, comment: detail.value })} rows={3} placeholder="Optional notes for your team" />
      </FormField>
      <FormField label="Type">
        <Select
          selectedOption={{ label: values.type === "Public" ? "Public hosted zone" : "Private hosted zone", value: values.type }}
          onChange={({ detail }) => onChange({ ...values, type: detail.selectedOption.value as "Public" | "Private" })}
          options={[
            { label: "Public hosted zone", value: "Public" },
            { label: "Private hosted zone", value: "Private" },
          ]}
        />
      </FormField>
      {values.type === "Private" && (
        <FormField label="VPC ID" errorText={errors?.private_vpc} description="VPC associated with this private zone.">
          <Input
            value={values.private_vpc}
            onChange={({ detail }) => {
              onChange({ ...values, private_vpc: detail.value });
              if (errors?.private_vpc && setErrors) setErrors((p) => ({ ...p, private_vpc: undefined }));
            }}
            placeholder="vpc-0a1b2c3d4e5f67890"
          />
        </FormField>
      )}
    </SpaceBetween>
  );
}

export default function HostedZonesPage() {
  const auth = useRequireAuth();
  const router = useRouter();
  const { notify } = useNotification();

  const [zones, setZones] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<{ label: string; value: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editZone, setEditZone] = useState<HostedZone | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [delegationZone, setDelegationZone] = useState<HostedZone | null>(null);
  const [delegationNs, setDelegationNs] = useState<DNSRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; private_vpc?: string }>({});
  const [form, setForm] = useState({ name: "", description: "", comment: "", type: "Public" as "Public" | "Private", private_vpc: "" });

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listHostedZones({
        search: search || undefined,
        type: typeFilter?.value || undefined,
        page,
        page_size: 10,
      });
      setZones(data.items);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setSelected([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      notify("error", "Failed to load hosted zones", err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, page, notify]);

  useEffect(() => {
    if (auth.loading || !auth.user) return;
    const t = setTimeout(fetchZones, 300);
    return () => clearTimeout(t);
  }, [fetchZones, auth.loading, auth.user]);

  useEffect(() => {
    const handler = () => {
      setErrors({});
      setForm({ name: "", description: "", comment: "", type: "Public", private_vpc: "" });
      setCreateOpen(true);
    };
    window.addEventListener("route53:create", handler);
    return () => window.removeEventListener("route53:create", handler);
  }, []);

  useEffect(() => {
    setErrors({});
    if (editZone) {
      setForm({
        name: editZone.name.replace(/\.$/, ""),
        description: editZone.description || "",
        comment: editZone.comment || "",
        type: editZone.type,
        private_vpc: editZone.private_vpc || "",
      });
    } else if (!createOpen) {
      setForm({ name: "", description: "", comment: "", type: "Public", private_vpc: "" });
    }
  }, [editZone, createOpen]);

  const showDelegation = async (zone: HostedZone) => {
    try {
      const data = await api.listRecords(zone.id, { type: "NS", page_size: 10 });
      setDelegationZone(zone);
      setDelegationNs(data.items.filter((r) => r.name === zone.name));
      setDelegationOpen(true);
    } catch (err) {
      notify("error", "Failed to load NS records", err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleCreate = async () => {
    const validationErrors: { name?: string; private_vpc?: string } = {};
    const domainName = form.name.trim();

    if (!domainName) {
      validationErrors.name = "Domain name is required (e.g. example.com)";
    }
    if (form.type === "Private" && !form.private_vpc.trim()) {
      validationErrors.private_vpc = "VPC ID is required for private hosted zones (e.g. vpc-0a1b2c3d4e5f67890)";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      notify("error", "Validation error", validationErrors.name || validationErrors.private_vpc);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const zone = await api.createHostedZone({
        ...form,
        name: domainName,
        private_vpc: form.type === "Private" ? form.private_vpc.trim() : undefined,
      });
      notify("success", "Hosted zone created");
      setCreateOpen(false);
      fetchZones();
      await showDelegation(zone);
    } catch (err) {
      notify("error", "Create failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editZone) return;
    const validationErrors: { name?: string; private_vpc?: string } = {};
    const domainName = form.name.trim();

    if (!domainName) {
      validationErrors.name = "Domain name is required (e.g. example.com)";
    }
    if (form.type === "Private" && !form.private_vpc.trim()) {
      validationErrors.private_vpc = "VPC ID is required for private hosted zones";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      notify("error", "Validation error", validationErrors.name || validationErrors.private_vpc);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await api.updateHostedZone(editZone.id, {
        ...form,
        name: domainName,
        private_vpc: form.type === "Private" ? form.private_vpc.trim() : undefined,
      });
      notify("success", "Hosted zone updated");
      setEditZone(null);
      fetchZones();
    } catch (err) {
      notify("error", "Update failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      if (selected.length > 0) {
        await api.bulkDeleteHostedZones(selected.map((z) => z.id));
      }
      notify("success", `Deleted ${selected.length} hosted zone(s)`);
      setDeleteOpen(false);
      fetchZones();
    } catch (err) {
      notify("error", "Delete failed", err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const copyId = async (id: string) => {
    if (await copyToClipboard(id)) notify("success", "Copied hosted zone ID");
    else notify("error", "Copy failed");
  };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="A hosted zone is a container for records that define how you want to route traffic for a domain and its subdomains."
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            {selected.length === 1 && (
              <Button iconName="edit" onClick={() => setEditZone(selected[0])}>Edit</Button>
            )}
            {selected.length > 0 && (
              <Button onClick={() => setDeleteOpen(true)} iconName="remove">Delete ({selected.length})</Button>
            )}
            <Button variant="primary" iconName="add-plus" onClick={() => setCreateOpen(true)}>Create hosted zone</Button>
          </SpaceBetween>
        }
      >
        Hosted zones
      </Header>

      <Table
        loading={loading}
        loadingText="Loading hosted zones"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        columnDefinitions={[
          {
            id: "name",
            header: "Hosted zone name",
            cell: (item) => (
              <Link href={`/hosted-zones/${toPagePathId(item.id)}`} onFollow={(e) => { e.preventDefault(); router.push(`/hosted-zones/${toPagePathId(item.id)}`); }}>
                {item.name}
              </Link>
            ),
            sortingField: "name",
          },
          {
            id: "id",
            header: "Hosted zone ID",
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Box variant="code" fontSize="body-s"><span title={item.id}>{truncateId(item.id)}</span></Box>
                <Button variant="inline-icon" iconName="copy" ariaLabel="Copy ID" onClick={() => copyId(item.id)} />
              </SpaceBetween>
            ),
          },
          {
            id: "type",
            header: "Type",
            cell: (item) => <StatusIndicator type={item.type === "Public" ? "info" : "success"}>{item.type}</StatusIndicator>,
          },
          { id: "count", header: "Record count", cell: (item) => item.record_count },
          { id: "desc", header: "Description", cell: (item) => item.description || "—" },
          { id: "created", header: "Created", cell: (item) => formatDate(item.created_at) },
          {
            id: "actions",
            header: "Actions",
            cell: (item) => (
              <ButtonDropdown
                ariaLabel="Actions"
                variant="inline-icon"
                expandToViewport
                items={[
                  { id: "view", text: "View records" },
                  { id: "edit", text: "Edit" },
                  { id: "delegation", text: "View NS delegation" },
                ]}
                onItemClick={({ detail }) => {
                  if (detail.id === "view") router.push(`/hosted-zones/${toPagePathId(item.id)}`);
                  if (detail.id === "edit") setEditZone(item);
                  if (detail.id === "delegation") showDelegation(item);
                }}
              />
            ),
          },
        ]}
        items={zones}
        trackBy="id"
        pagination={
          <Pagination currentPageIndex={page} pagesCount={totalPages} onChange={({ detail }) => setPage(detail.currentPageIndex)} />
        }
        empty={
          <Box textAlign="center" color="inherit">
            <b>No hosted zones</b>
            <Box padding={{ bottom: "s" }} variant="p" color="inherit">Create a hosted zone to get started.</Box>
            <Button onClick={() => setCreateOpen(true)}>Create hosted zone</Button>
          </Box>
        }
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <Input type="search" value={search} onChange={({ detail }) => { setSearch(detail.value); setPage(1); }} placeholder="Filter by name or ID" />
            <Select
              selectedOption={typeFilter}
              onChange={({ detail }) => { setTypeFilter(detail.selectedOption as { label: string; value: string }); setPage(1); }}
              placeholder="All types"
              options={[{ label: "All types", value: "" }, { label: "Public", value: "Public" }, { label: "Private", value: "Private" }]}
            />
            {(search || typeFilter?.value) && <Button onClick={() => { setSearch(""); setTypeFilter(null); setPage(1); }}>Clear filters</Button>}
          </SpaceBetween>
        }
        header={
          <Header counter={`(${total})`} actions={<Button iconName="refresh" onClick={fetchZones} />}>
            Hosted zones
          </Header>
        }
      />

      <Modal visible={createOpen} onDismiss={() => setCreateOpen(false)} header="Create hosted zone" footer={
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleCreate}>Create</Button>
        </SpaceBetween></Box>
      }>
        <ZoneFormFields values={form} onChange={setForm} errors={errors} setErrors={setErrors} />
      </Modal>

      <Modal visible={!!editZone} onDismiss={() => setEditZone(null)} header="Edit hosted zone" footer={
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setEditZone(null)}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleEdit}>Save</Button>
        </SpaceBetween></Box>
      }>
        <ZoneFormFields values={form} onChange={setForm} errors={errors} setErrors={setErrors} />
      </Modal>

      <Modal visible={deleteOpen} onDismiss={() => setDeleteOpen(false)} header="Delete hosted zones" footer={
        <Box float="right"><SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleDelete}>Delete</Button>
        </SpaceBetween></Box>
      }>
        Delete {selected.length} hosted zone(s) and all their records?
      </Modal>

      <Modal
        visible={delegationOpen}
        onDismiss={() => setDelegationOpen(false)}
        header="Delegation instructions"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDelegationOpen(false)}>Close</Button>
              {delegationZone && (
                <Button variant="primary" onClick={() => router.push(`/hosted-zones/${toPagePathId(delegationZone.id)}`)}>
                  View records
                </Button>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">
            To make Route 53 the DNS service for <Box variant="strong" display="inline">{delegationZone?.name}</Box>, update your registrar with these name servers:
          </Box>
          {delegationNs.length > 0 ? (
            delegationNs[0].value.split("\n").map((ns) => (
              <SpaceBetween key={ns} direction="horizontal" size="xs">
                <Box variant="code">{ns}</Box>
                <Button variant="inline-icon" iconName="copy" ariaLabel="Copy" onClick={() => copyId(ns)} />
              </SpaceBetween>
            ))
          ) : (
            <StatusIndicator type="warning">NS records not found</StatusIndicator>
          )}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
