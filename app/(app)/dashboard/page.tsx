"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, AlertCircle, Loader2, FolderOpen, TrendingUp, BarChart3, Building2, Bot, Wrench, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/lib/organization-context";

interface ReportStats {
  completedThisWeek: number;
  completedThisMonth: number;
  completedLastMonth: number;
  totalTimeThisWeek: number;
  totalTimeThisMonth: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  activeProjects: number;
  totalTasks: number;
  overdueTasks: number;
}

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { organizations, selectedOrg, setSelectedOrg, loading: orgLoading } = useOrganization();

  useEffect(() => {
    if (!orgLoading) fetchStats();
  }, [selectedOrg, orgLoading]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") {
        params.set("organizationId", selectedOrg);
      }
      const response = await fetch(`/api/reports/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Cargando métricas...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">
        No se pudieron cargar las estadísticas
      </div>
    );
  }

  const totalByStatus = Object.values(stats.tasksByStatus).reduce((a, b) => a + b, 0) || 1;

  const monthChange = stats.completedLastMonth > 0
    ? Math.round(((stats.completedThisMonth - stats.completedLastMonth) / stats.completedLastMonth) * 100)
    : stats.completedThisMonth > 0 ? 100 : 0;

  const statCards = [
    { 
      name: "Completadas esta semana", 
      value: stats.completedThisWeek, 
      icon: CheckSquare, 
    },
    { 
      name: "Completadas este mes", 
      value: stats.completedThisMonth, 
      icon: TrendingUp, 
      change: monthChange,
    },
    { 
      name: "Proyectos activos", 
      value: stats.activeProjects, 
      icon: FolderOpen, 
    },
    { 
      name: "Tareas vencidas", 
      value: stats.overdueTasks, 
      icon: AlertCircle, 
      isWarning: stats.overdueTasks > 0,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Panel Principal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Hola, {session?.user?.name || "Usuario"}. Aquí está el resumen general de tu actividad.
          </p>
        </div>

        {organizations.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-[180px] text-xs">
                <SelectValue placeholder="Organización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Agencias</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</div>
              {stat.change !== undefined && (
                <div className="mt-1.5">
                  <Badge variant={stat.change >= 0 ? "emerald" : "crimson"} className="text-[10px]">
                    {stat.change >= 0 ? "↑" : "↓"} {Math.abs(stat.change)}% vs mes previo
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Doc Metrics */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span>Métricas del Agente IA (Doc)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocMetrics organizationId={selectedOrg === "all" ? null : selectedOrg} />
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>Tareas por Estado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3.5">
              {Object.entries(statusLabels).map(([key, label]) => {
                const count = stats.tasksByStatus[key] || 0;
                const percentage = Math.round((count / totalByStatus) * 100);
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Priority */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>Tareas por Prioridad</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3.5">
              {Object.entries(priorityLabels).map(([key, label]) => {
                const count = stats.tasksByPriority[key] || 0;
                const total = Object.values(stats.tasksByPriority).reduce((a, b) => a + b, 0) || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocMetrics({ organizationId }: { organizationId: string | null }) {
  const [data, setData] = useState<{ totalQueries: number; totalTools: number; queriesByDay: Record<string, number>; topTools: { name: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = organizationId ? `?organizationId=${organizationId}` : "";
    fetch(`/api/doc-usage${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!data || data.totalQueries === 0) {
    return <div className="text-center py-6 text-muted-foreground text-xs">Sin datos registrados aún para el agente IA.</div>;
  }

  const toolsPerQuery = data.totalQueries > 0 ? (data.totalTools / data.totalQueries).toFixed(1) : "0";
  const maxToolCount = data.topTools[0]?.count || 1;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
          <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-xl font-bold text-foreground">{data.totalQueries.toLocaleString()}</div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consultas</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
          <Wrench className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-xl font-bold text-foreground">{data.totalTools.toLocaleString()}</div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tools ejecutadas</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/40 border border-border">
          <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-xl font-bold text-foreground">{toolsPerQuery}</div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tools / consulta</div>
        </div>
      </div>
      {data.topTools.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Herramientas más utilizadas</h4>
          <div className="space-y-2">
            {data.topTools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground w-36 truncate text-[11px]">{tool.name}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(tool.count / maxToolCount) * 100}%` }} />
                </div>
                <span className="font-mono text-muted-foreground w-8 text-right text-[11px]">{tool.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
