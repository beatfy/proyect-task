"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, DollarSign, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/lib/organization-context";

interface SearchResult {
  contacts: { id: string; name: string; email: string | null; company: string | null; status: string; _count: { deals: number; activities: number } }[];
  deals: { id: string; title: string; value: number; probability: number; contact: { name: string }; stage: { name: string; color: string } }[];
}

const statusLabels: Record<string, string> = {
  LEAD: "Lead",
  CONTACTED: "Contactado",
  QUALIFIED: "Cualificado",
  CUSTOMER: "Cliente",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export default function CrmGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { selectedOrg } = useOrganization();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      const response = await fetch(`/api/crm/search?${params.toString()}`);
      if (response.ok) {
        setResults(await response.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const hasResults = results && (results.contacts.length > 0 || results.deals.length > 0);
  const isEmpty = query.length >= 2 && !loading && results && !hasResults;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Buscar contactos, deals... (⌘K)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (hasResults || isEmpty || loading) && (
        <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {isEmpty && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados para &ldquo;{query}&rdquo;
            </div>
          )}

          {hasResults && (
            <>
              {results.contacts.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase proyectoing-wider">
                      Contactos ({results.contacts.length})
                    </span>
                  </div>
                  {results.contacts.map((contact) => (
                    <button
                      key={contact.id}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
                      onClick={() => { router.push(`/crm/contacts/${contact.id}`); setOpen(false); setQuery(""); }}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium flex-shrink-0">
                        {contact.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.email || contact.company || statusLabels[contact.status]}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {contact._count.deals} deals
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.deals.length > 0 && (
                <div className="p-2 border-t border-border">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase proyectoing-wider">
                      Deals ({results.deals.length})
                    </span>
                  </div>
                  {results.deals.map((deal) => (
                    <button
                      key={deal.id}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
                      onClick={() => { router.push(`/crm/deals/${deal.id}`); setOpen(false); setQuery(""); }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 border border-border"
                        style={{ borderColor: deal.stage.color, color: deal.stage.color }}>
                        $
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {deal.contact.name} · {deal.stage.name}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-foreground flex-shrink-0">
                        {formatCurrency(deal.value)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
