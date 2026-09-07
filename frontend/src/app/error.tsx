"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="login-shell">
      <Container>
        <SpaceBetween size="m">
          <Header variant="h1">Something went wrong</Header>
          <Box color="text-body-secondary">
            {process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred. Please try again."}
          </Box>
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={reset}>Try again</Button>
            <Button onClick={() => router.push("/hosted-zones")}>Go to hosted zones</Button>
          </SpaceBetween>
        </SpaceBetween>
      </Container>
    </div>
  );
}
