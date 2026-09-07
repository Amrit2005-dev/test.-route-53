"use client";

import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CloudscapeShell } from "@/components/cloudscape/CloudscapeShell";
import { NotificationFlashbar } from "@/components/ui";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <CloudscapeShell>
            <NotificationFlashbar />
            <KeyboardShortcuts />
            {children}
          </CloudscapeShell>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
