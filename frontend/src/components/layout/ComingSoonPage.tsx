"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";

const SECTION_DETAILS: Record<string, { description: string; status: string; bullets: string[] }> = {
  dashboard: {
    description: "Console overview for DNS health, recent activity, and quick actions.",
    status: "Available",
    bullets: ["Live hosted zone and record counts", "Recent DNS activity feed", "Quick links to core workflows"],
  },
  "health checks": {
    description: "Monitor endpoint health for routing and failover decisions.",
    status: "Available",
    bullets: ["Endpoint health status panels", "HTTP/HTTPS/TCP check configuration", "Create and manage checks"],
  },
  "traffic policies": {
    description: "Routing policies, templates, and traffic steering controls.",
    status: "Preview",
    bullets: ["Policy templates and version history", "Weighted and failover routing", "Policy review for DNS teams"],
  },
  resolver: {
    description: "Resolver rules and inbound/outbound DNS routing.",
    status: "Preview",
    bullets: ["Resolver rule management", "Inbound and outbound routing", "Enterprise DNS forwarding"],
  },
  profiles: {
    description: "Account preferences and console settings.",
    status: "Preview",
    bullets: ["Account-level preferences", "Team profile management", "Role and access configuration"],
  },
};

export function ComingSoonPage({ title }: { title: string }) {
  const router = useRouter();
  const key = title.toLowerCase();
  const details = SECTION_DETAILS[key] ?? {
    description: "This Route 53 feature is a high-fidelity console preview.",
    status: "Preview",
    bullets: ["AWS-inspired layout", "Clear navigation and hierarchy", "Seamless handoff to hosted zones"],
  };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description={details.description}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={() => router.push("/hosted-zones")}>Open Hosted zones</Button>
            <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </SpaceBetween>
        }
      >
        {title}
      </Header>

      <Container header={<Header variant="h2">What this section includes</Header>}>
        <SpaceBetween size="s">
          {details.bullets.map((bullet) => (
            <Box key={bullet}>• {bullet}</Box>
          ))}
        </SpaceBetween>
      </Container>

      <Container>
        <Box fontSize="heading-s" fontWeight="bold">{details.status}</Box>
        <Box color="text-body-secondary" padding={{ top: "xs" }}>
          Core DNS workflows are fully functional under Hosted zones. This section extends the console experience.
        </Box>
      </Container>
    </SpaceBetween>
  );
}
