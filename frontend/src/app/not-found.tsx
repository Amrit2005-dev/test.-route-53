"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <Box margin={{ top: "xxl" }} padding="xxl" textAlign="center">
      <Container
        header={<Header variant="h1">404 - Page Not Found</Header>}
      >
        <SpaceBetween size="l">
          <Box variant="p" color="text-body-secondary">
            The page or resource you are looking for could not be found.
          </Box>
          <div>
            <Button variant="primary" onClick={() => router.push("/hosted-zones")}>
              Return to Hosted Zones
            </Button>
          </div>
        </SpaceBetween>
      </Container>
    </Box>
  );
}
