"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { OrganizationProvider } from "@/lib/organization-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <OrganizationProvider>
          {children}
          <Toaster />
        </OrganizationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}