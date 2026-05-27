"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, DollarSign, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import CrmGlobalSearch from "@/components/crm/CrmGlobalSearch";
import { FunnelChart, RevenueForecast } from "@/components/crm/FunnelChart";

interface CrmStats {
  totalContacts: number;
  leadsCount: number;
  contactsByStatus: Record<string, number>;
  openDealsCount: number;
  pipelineValue: number;
  weightedValue: number;
  pipelineStages: { id: string; name: string; color: string; position: number; dealCount: number; totalValue: number }[];
  recentContacts: { id: string; name: string; email: string | null; company: string | null; status: string; createdAt: string }[];
  recentDeals: { id: string; title: string; value: number; contact: { name: string } | null; stage: { name: string; color: string } }[];
  recentActivities: { id: string; type: string; title: string; createdAt: string; contact: { name: string } }[];
}

const statusLabels: Record<string, string> = {
  LEAD: "Prospecto",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  CUSTOMER: "Cliente Activo",
};

const statusColors: Record<string, string> = {
  LEAD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CONTACTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  QUALIFIED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CUSTOMER: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const activityIcons: Record<string, string> = {
  CALL: "📞",
  EMAIL: "✉️",
  MEETING: "📅",
  TASK: "✅",
  NOTE: "📝",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Probability defaults for forecast (could come from stage config in the future)
const stageProbabilityDefaults: Record<number, number> = {
  0: 10,
  1: 25,
  2: 50,
  3: 75,
  4: 90,
  5: 100,
};

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedOrg, loading: orgLoading } = useOrganization();

  useEffect(() => {
    if (!orgLoading) fetchStats();
  }, [selectedOrg, orgLoading]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") {
        params.set("organizationId", selectedOrg);
      }
      const response = await fetch(`/api/crm/stats?${params.toString()}`);
      if (response.ok) {
        setStats(await response.json());
      }
    } catch (error) {
      console.error("Error loading CRM stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Error al cargar estadísticas de CRM</p>
      </div>
    );
  }

  const totalStatusCount = Object.values(stats.contactsByStatus).reduce((a, b) => a + b, 0) || 1;
  const maxStageValue = Math.max(...stats.pipelineStages.map(s => s.totalValue), 1);

  // Enrich stages with probability for forecast
  const enrichedStages = stats.pipelineStages.map(s => ({
    ...s,
    probability: stageProbabilityDefaults[s.position] || 50,
  }));

  // Top deals by value (use recent deals as proxy, sorted by value desc)
  const topDeals = [...stats.recentDeals].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">Gestión de oportunidads, salas y pipeline de CRMs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <CrmGlobalSearch />
          <Link href="/crm/contacts">
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Contactos
            </Button>
          </Link>
          <Link href="/crm/pipeline">
            <Button size="sm">
              <DollarSign className="h-4 w-4 mr-2" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contactos</CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.leadsCount} salas/promotores activos</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Oportunidads Abiertos</CardTitle>
            <TrendingUp className="h-5 w-5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.openDealsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">En pipeline de CRM</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Pipeline</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.pipelineValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Presupuestos totales pendientes</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Ponderado</CardTitle>
            <DollarSign className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.weightedValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ajustado por probabilidad</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Advanced sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contacts by Status */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Contactos por Estado</CardTitle>
                  <Link href="/crm/contacts" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(statusLabels).map(([key, label]) => {
                    const count = stats.contactsByStatus[key] || 0;
                    const percentage = Math.round((count / totalStatusCount) * 100);
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground">{label}</span>
                          <span className="text-sm font-medium text-foreground">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Stages */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Oportunidads por Etapa</CardTitle>
                  <Link href="/crm/pipeline" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Ver oportunidads <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.pipelineStages.map((stage) => (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span className="text-sm text-foreground">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{stage.dealCount} oportunidads</span>
                          <span className="text-sm font-medium text-foreground">{formatCurrency(stage.totalValue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(stage.totalValue / maxStageValue) * 100}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funnel">
          <Card className="bg-card border-border">
            <CardHeader>
                  <CardTitle className="text-foreground">Funnel de Oportunidads</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart stages={enrichedStages} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Revenue Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueForecast stages={enrichedStages} />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Oportunidads más Valiosos</CardTitle>
              </CardHeader>
              <CardContent>
                {topDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidads</p>
                ) : (
                  <div className="space-y-3">
                    {topDeals.map((deal, idx) => (
                      <Link key={deal.id} href={`/crm/deals/${deal.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                            <p className="text-xs text-muted-foreground">{deal.contact?.name || "Sin contacto"} · {deal.stage.name}</p>
                          </div>
                          <span className="text-sm font-semibold text-foreground flex-shrink-0">
                            {formatCurrency(deal.value)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom Section: Recent Contacts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Contactos Recientes</CardTitle>
              <Link href="/crm/contacts" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentContacts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Sin contactos aún</p>
            ) : (
              <div className="space-y-3">
                {stats.recentContacts.map((contact) => (
                  <Link key={contact.id} href={`/crm/contacts/${contact.id}`}>
                    <div className="flex items-center justify-between p-1 rounded-md hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium flex-shrink-0">
                          {contact.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{contact.email || contact.company || "—"}</p>
                        </div>
                      </div>
                      <Badge className={statusColors[contact.status]}>{statusLabels[contact.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivities.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Sin actividades aún</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <div className="text-lg">{activityIcons[activity.type] || "📌"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.contact.name}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {timeAgo(activity.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
