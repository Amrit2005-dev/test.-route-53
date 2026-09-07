"use client";

import { useEffect, useRef, useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import { IconCopy, IconSearch } from "@/components/icons";
import { copyToClipboard } from "@/lib/format";

export function NotificationFlashbar() {
  const { notifications, dismiss } = useNotification();
  if (notifications.length === 0) return null;

  return (
    <div className="fixed right-4 top-12 z-[60] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="aws-card flex items-start gap-3 p-4 shadow-lg"
          style={{
            borderLeftWidth: 4,
            borderLeftColor:
              n.type === "success" ? "var(--aws-success)" : n.type === "error" ? "var(--aws-error)" : "var(--aws-link)",
          }}
        >
          <div className="flex-1">
            <div className="font-semibold">{n.title}</div>
            {n.message && <div className="mt-1 text-sm text-[var(--aws-text-secondary)]">{n.message}</div>}
          </div>
          <button type="button" className="aws-btn-icon" onClick={() => dismiss(n.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16" onClick={onClose}>
      <div
        className={`aws-card w-full ${width} shadow-2xl`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--aws-border)" }}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="aws-btn-icon text-lg" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="aws-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--aws-text-secondary)]">
      <span>
        {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className="aws-btn-secondary px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ‹
        </button>
        <span className="px-2">
          Page {page} of {totalPages}
        </span>
        <button type="button" className="aws-btn-secondary px-2 py-1 disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          ›
        </button>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Filter by name or ID",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aws-text-secondary)]">
        <IconSearch />
      </span>
      <input
        type="search"
        className="aws-input pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="aws-skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      <div className="text-lg font-medium text-[var(--aws-text-secondary)]">{title}</div>
      {description && <p className="mt-2 text-sm text-[var(--aws-text-secondary)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
  loading = false,
  danger = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="aws-btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "aws-btn-primary !bg-[var(--aws-error)] !border-[#ba2e0f]" : "aws-btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[var(--aws-text-secondary)]">{message}</p>
    </Modal>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { notify } = useNotification();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      notify("success", "Copied to clipboard", label || value);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button type="button" className="aws-btn-icon" onClick={handleCopy} title="Copy" aria-label="Copy">
      <IconCopy className={copied ? "text-[var(--aws-success)]" : ""} />
    </button>
  );
}

export function ActionsDropdown({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="aws-btn-secondary px-2 py-1 text-xs" onClick={() => setOpen((o) => !o)}>
        Actions ▾
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 min-w-[140px] rounded border py-1 shadow-lg"
          style={{ background: "var(--aws-surface)", borderColor: "var(--aws-border)" }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--aws-surface-alt)] disabled:opacity-40"
              style={{ color: item.danger ? "var(--aws-error)" : "var(--aws-text)" }}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  onClear,
  hasActiveFilters,
  onRefresh,
  extra,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  onRefresh?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="aws-toolbar">
      <div className="min-w-[200px] flex-1">
        <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
      </div>
      {filters}
      {hasActiveFilters && onClear && (
        <button type="button" className="aws-btn-link text-sm" onClick={onClear}>
          Clear filters
        </button>
      )}
      {onRefresh && (
        <button type="button" className="aws-btn-secondary" onClick={onRefresh}>
          Refresh
        </button>
      )}
      {extra}
    </div>
  );
}

export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--aws-orange)]" />;
}
