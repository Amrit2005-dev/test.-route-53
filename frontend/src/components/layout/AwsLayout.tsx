"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { IconMenu, IconMoon, IconRoute53, IconSun } from "@/components/icons";

const SIDEBAR_ITEMS = [
  { href: "/dashboard", label: "Dashboard", section: "Overview" },
  { href: "/hosted-zones", label: "Hosted zones", section: "DNS" },
  { href: "/health-checks", label: "Health checks", section: "DNS" },
  { href: "/traffic-policies", label: "Traffic policies", section: "DNS" },
  { href: "/resolver", label: "Resolver", section: "DNS" },
  { href: "/profiles", label: "Profiles", section: "DNS" },
];

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

export function AwsHeader({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [region] = useState("us-east-1");

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-50 text-white" style={{ background: "var(--aws-header)" }}>
      <div className="flex h-10 items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <button type="button" className="aws-btn-icon text-gray-300 md:hidden" onClick={onMenuToggle} aria-label="Menu">
            <IconMenu />
          </button>
          <Link href="/hosted-zones" className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: "var(--aws-orange)" }}>
              aws
            </span>
          </Link>
          <span className="hidden text-gray-400 sm:inline">|</span>
          <div className="hidden items-center gap-1.5 sm:flex">
            <IconRoute53 className="text-[var(--aws-orange)]" />
            <span className="text-sm font-medium">Route 53</span>
          </div>
        </div>

        <div className="hidden max-w-md flex-1 px-8 lg:block">
          <div className="relative">
            <input
              type="search"
              placeholder="Search services, resources..."
              className="w-full rounded border-0 bg-[var(--aws-header-hover)] px-3 py-1 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-[var(--aws-orange)]"
              onFocus={(e) => e.target.blur()}
              readOnly
              title="Global search (mock)"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <select
            className="hidden rounded border-0 bg-[var(--aws-header-hover)] px-2 py-1 text-xs text-gray-200 sm:block"
            value={region}
            onChange={() => {}}
            aria-label="Region"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" className="aws-btn-icon text-gray-300" onClick={toggleTheme} title="Toggle dark mode (⌘⇧D)">
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          {user && (
            <>
              <span className="hidden text-gray-400 lg:inline">{user.account_id}</span>
              <span className="hidden text-gray-300 md:inline">{user.display_name}</span>
              <button type="button" onClick={() => logout()} className="rounded px-2 py-1 text-gray-300 hover:bg-[var(--aws-header-hover)] hover:text-white">
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = Array.from(new Set(SIDEBAR_ITEMS.map((i) => i.section)));

  return (
    <nav className="py-2">
      {sections.map((section) => (
        <div key={section} className="mb-2">
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--aws-text-secondary)]">
            {section}
          </div>
          {SIDEBAR_ITEMS.filter((i) => i.section === section).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="mx-2 flex items-center rounded px-3 py-2 text-sm transition-colors"
                style={
                  active
                    ? { background: "var(--aws-sidebar-active-bg)", color: "var(--aws-sidebar-active)", fontWeight: 500 }
                    : { color: "var(--aws-text)" }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <AwsHeader onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1">
        <aside
          className="hidden shrink-0 border-r md:block"
          style={{
            width: "var(--aws-sidebar-width)",
            background: "var(--aws-sidebar)",
            borderColor: "var(--aws-border)",
          }}
        >
          <SidebarNav />
        </aside>

        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside
              className="fixed left-0 top-10 z-50 h-[calc(100vh-2.5rem)] w-64 border-r shadow-xl md:hidden"
              style={{ background: "var(--aws-sidebar)", borderColor: "var(--aws-border)" }}
            >
              <SidebarNav onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-4 text-sm text-[var(--aws-text-secondary)]" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 && <span className="mx-2 text-[var(--aws-border)]">›</span>}
          {item.href ? (
            <Link href={item.href} className="aws-btn-link">
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--aws-text)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full" style={{ background: "var(--aws-bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="aws-page-title">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-[var(--aws-text-secondary)]">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <PageLayout
      title={title}
      description="This feature is not available in this Route 53 clone demo."
      breadcrumbs={[{ label: "Route 53", href: "/hosted-zones" }, { label: title }]}
    >
      <div className="aws-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--aws-surface-alt)" }}>
          <IconRoute53 className="h-8 w-8 text-[var(--aws-orange)]" />
        </div>
        <h2 className="text-xl font-semibold">Coming Soon</h2>
        <p className="mt-2 text-[var(--aws-text-secondary)]">The {title} section is a placeholder in this demo.</p>
        <Link href="/hosted-zones" className="aws-btn-primary mt-6 inline-flex">
          Go to Hosted zones
        </Link>
      </div>
    </PageLayout>
  );
}
