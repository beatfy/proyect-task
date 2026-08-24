"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { OrganizationProvider } from "@/lib/organization-context";
import { PWAInstaller } from "@/components/pwa/PWAInstaller";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <OrganizationProvider>
          {children}
          <Toaster />
          <PWAInstaller />
        </OrganizationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}