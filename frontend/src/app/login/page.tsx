"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useAuth, ApiError } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const { notify } = useNotification();
  const router = useRouter();

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      notify("success", "Signed in successfully");
      router.push("/hosted-zones");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sign in failed. Please try again.";
      setError(message);
      notify("error", "Sign in failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <ColumnLayout columns={2} variant="text-grid">
        <Container header={<Header variant="h1">Route 53</Header>}>
          <SpaceBetween size="m">
            <Box variant="p" color="text-body-secondary">
              Sign in to the Route 53 console clone — hosted zones, DNS records, health checks, and AWS-style workflows.
            </Box>
            <Box padding="s" variant="div">
              <StatusNote title="Demo credentials" detail="Use admin / admin123 to explore without setup." />
            </Box>
            <Box padding="s" variant="div">
              <StatusNote title="Session-based auth" detail="Cookie sessions mirror a real AWS console sign-in flow." />
            </Box>
          </SpaceBetween>
        </Container>

        <Container>
          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
            <SpaceBetween size="m">
              <Header variant="h2" description="Sign in with your AWS account">Welcome back</Header>
              <FormField label="Username">
                <Input autoFocus value={username} onChange={({ detail }) => setUsername(detail.value)} />
              </FormField>
              <FormField label="Password">
                <Input type="password" value={password} onChange={({ detail }) => setPassword(detail.value)} />
              </FormField>
              <Button variant="primary" loading={loading} onClick={() => void handleSubmit()} fullWidth>
                Sign in
              </Button>
              {error && (
                <Box color="text-status-error" fontSize="body-s">{error}</Box>
              )}
              <Box fontSize="body-s" color="text-body-secondary">
                Demo: <Box variant="strong" display="inline">admin / admin123</Box>
              </Box>
            </SpaceBetween>
          </form>
        </Container>
      </ColumnLayout>
    </div>
  );
}

function StatusNote({ title, detail }: { title: string; detail: string }) {
  return (
    <Box>
      <Box fontWeight="bold">{title}</Box>
      <Box color="text-body-secondary">{detail}</Box>
    </Box>
  );
}
