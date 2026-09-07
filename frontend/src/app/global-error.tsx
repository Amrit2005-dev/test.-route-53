"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="login-shell">
          <Container>
            <SpaceBetween size="m">
              <Header variant="h1">Application error</Header>
              <Box color="text-body-secondary">
                {process.env.NODE_ENV === "development" ? error.message : "The application encountered an error."}
              </Box>
              <Button variant="primary" onClick={reset}>Reload</Button>
            </SpaceBetween>
          </Container>
        </div>
      </body>
    </html>
  );
}
