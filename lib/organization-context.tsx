"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  selectedOrg: string;
  setSelectedOrg: (id: string) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  selectedOrg: "all",
  setSelectedOrg: () => {},
  loading: true,
});

const STORAGE_KEY = "selectedOrg";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrgState] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved org from localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSelectedOrgState(saved);

    // Fetch organizations list
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrganizations(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setSelectedOrg = useCallback((id: string) => {
    setSelectedOrgState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <OrganizationContext.Provider value={{ organizations, selectedOrg, setSelectedOrg, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
