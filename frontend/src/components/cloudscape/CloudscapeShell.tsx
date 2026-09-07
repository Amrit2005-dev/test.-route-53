"use client";

import { useState } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import Box from "@cloudscape-design/components/box";
import Input from "@cloudscape-design/components/input";
import SideNavigation, { SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "section", text: "Overview", items: [{ type: "link", text: "Dashboard", href: "/dashboard" }] },
  {
    type: "section",
    text: "DNS",
    items: [
      { type: "link", text: "Hosted zones", href: "/hosted-zones" },
      { type: "link", text: "Health checks", href: "/health-checks" },
      { type: "link", text: "Traffic policies", href: "/traffic-policies" },
      { type: "link", text: "Resolver", href: "/resolver" },
      { type: "link", text: "Profiles", href: "/profiles" },
    ],
  },
];

export function CloudscapeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [searchVal, setSearchVal] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Global");

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const activeHref =
    NAV_ITEMS.flatMap((s) => ("items" in s && s.items ? s.items : []))
      .filter((i) => i.type === "link")
      .map((i) => (i as { href: string }).href)
      .sort((a, b) => b.length - a.length)
      .find((href) => pathname === href || pathname.startsWith(`${href}/`)) || pathname;

  return (
    <>
      <div id="aws-top-nav">
        <TopNavigation
          identity={{
            href: "/hosted-zones",
            logo: { src: "/aws-logo.svg", alt: "AWS" },
            onFollow: (e) => {
              e.preventDefault();
              router.push("/hosted-zones");
            },
          }}
          search={
            <Input
              type="search"
              placeholder="Search [Alt+S]"
              ariaLabel="Search"
              value={searchVal}
              onChange={({ detail }) => setSearchVal(detail.value)}
              onKeyDown={(e) => {
                if (e.detail.key === "Enter" && searchVal.trim()) {
                  router.push(`/hosted-zones?search=${encodeURIComponent(searchVal.trim())}`);
                }
              }}
            />
          }
          i18nStrings={{
            searchIconAriaLabel: "Search",
            searchDismissIconAriaLabel: "Close search",
            overflowMenuTitleText: "More",
            overflowMenuBackIconAriaLabel: "Back",
          }}
          utilities={[
            {
              type: "menu-dropdown",
              text: "Services",
              iconName: "menu",
              items: [
                { id: "hosted-zones", text: "Hosted zones" },
                { id: "health-checks", text: "Health checks" },
                { id: "dashboard", text: "Dashboard" },
                { id: "traffic-policies", text: "Traffic policies" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "hosted-zones") router.push("/hosted-zones");
                else if (detail.id === "health-checks") router.push("/health-checks");
                else if (detail.id === "dashboard") router.push("/dashboard");
                else if (detail.id === "traffic-policies") router.push("/traffic-policies");
              },
            },
            {
              type: "button",
              iconName: "view-full",
              ariaLabel: "AWS CloudShell",
              onClick: () => {},
            },
            {
              type: "button",
              iconName: "notification",
              ariaLabel: "Notifications",
              onClick: () => {},
            },
            {
              type: "button",
              iconName: "status-info",
              ariaLabel: "Help",
              onClick: () => {},
            },
            {
              type: "button",
              iconName: "settings",
              ariaLabel: "Settings",
              onClick: () => {},
            },
            {
              type: "menu-dropdown",
              text: selectedRegion,
              ariaLabel: "Region selector",
              items: [
                { id: "global", text: "Global" },
                { id: "us-east-1", text: "US East (N. Virginia) us-east-1" },
                { id: "us-east-2", text: "US East (Ohio) us-east-2" },
                { id: "us-west-2", text: "US West (Oregon) us-west-2" },
                { id: "eu-west-1", text: "Europe (Ireland) eu-west-1" },
                { id: "ap-southeast-1", text: "Asia Pacific (Singapore) ap-southeast-1" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "global") setSelectedRegion("Global");
                else setSelectedRegion(detail.id);
              },
            },
            {
              type: "button",
              text: theme === "dark" ? "Light mode" : "Dark mode",
              ariaLabel: "Toggle dark mode",
              onClick: toggleTheme,
            },
            {
              type: "menu-dropdown",
              text: user?.display_name || "Route53 Admin",
              description: user?.account_id ? `Account ID: ${user.account_id}` : undefined,
              iconName: "user-profile",
              items: [
                { id: "account", text: `Account ID: ${user?.account_id || "123456789012"}` },
                { id: "org", text: "Organization" },
                { id: "signout", text: "Sign out" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "signout") logout();
              },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#aws-top-nav"
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigationWidth={260}
        navigation={
          <SideNavigation
            activeHref={activeHref}
            header={{ href: "/hosted-zones", text: "Route 53" }}
            items={NAV_ITEMS}
            onFollow={(e) => {
              if (!e.detail.external) {
                e.preventDefault();
                router.push(e.detail.href);
              }
            }}
          />
        }
        content={
          <Box padding={{ horizontal: "l", vertical: "l" }}>
            {children}
          </Box>
        }
        toolsHide
      />
    </>
  );
}
