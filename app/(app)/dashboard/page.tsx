"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, CheckCircle, AlertCircle, Loader2, FolderOpen, TrendingUp, BarChart3, Building2, Bot, Wrench, Zap, Disc3, Headphones } from "lucide-react";
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

const statusColors: Record<string, string> = {
  TODO: "bg-slate-500",
  INPROGRESS: "bg-blue-500",
  INREVIEW: "bg-yellow-500",
  DONE: "bg-green-500",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-400",
  LOW: "bg-slate-500",
  MEDIUM: "bg-orange-500",
  HIGH: "bg-red-500",
  URGENT: "bg-purple-600",
};

function formatDuration(seconds: number): string {
  if (!seconds) return "0h 0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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

  const handleOrgChange = (value: string) => {
    setSelectedOrg(value);
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
        <p className="text-muted-foreground">Error al cargar estadísticas</p>
      </div>
    );
  }

  const totalByStatus = Object.values(stats.tasksByStatus).reduce((a, b) => a + b, 0) || 1;

  const monthChange = stats.completedLastMonth > 0
    ? Math.round(((stats.completedThisMonth - stats.completedLastMonth) / stats.completedLastMonth) * 100)
    : stats.completedThisMonth > 0 ? 100 : 0;

  const statCards = [
    { name: "Completadas esta semana", value: stats.completedThisWeek, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
    { name: "Completadas este mes", value: stats.completedThisMonth, icon: TrendingUp, color: "text-neutral-900", bg: "bg-neutral-50 dark:bg-indigo-900/20", change: monthChange },
    { name: "Clientes activos", value: stats.activeProjects, icon: FolderOpen, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20" },
    { name: "Tareas vencidas", value: stats.overdueTasks, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    { name: "Total tareas", value: stats.totalTasks, icon: CheckSquare, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              ¡Hola, {session?.user?.name || "Usuario"}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Aquí tienes un resumen de tu actividad
            </p>
          </div>
          {organizations.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className={`bg-card border-border ${stat.bg}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              {stat.change !== undefined && (
                <p className={`text-xs mt-1 ${stat.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {stat.change >= 0 ? "↑" : "↓"} {Math.abs(stat.change)}% vs mes anterior
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Metrics */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            Métricas de Ledy (Agente IA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LedyMetrics organizationId={selectedOrg === "all" ? null : selectedOrg} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-neutral-900" />
              Tareas por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusLabels).map(([key, label]) => {
                const count = stats.tasksByStatus[key] || 0;
                const percentage = Math.round((count / totalByStatus) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusColors[key]}`} />
                        <span className="text-sm text-foreground">{label}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${statusColors[key]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Priority Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-neutral-900" />
              Tareas por Prioridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(priorityLabels).map(([key, label]) => {
                const count = stats.tasksByPriority[key] || 0;
                const total = Object.values(stats.tasksByPriority).reduce((a, b) => a + b, 0) || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${priorityColors[key]}`} />
                        <span className="text-sm text-foreground">{label}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${priorityColors[key]} transition-all duration-500`}
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

const TOOL_COLORS = ["bg-green-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];

function LedyMetrics({ organizationId }: { organizationId: string | null }) {
  const [data, setData] = useState<{ totalQueries: number; totalTools: number; queriesByDay: Record<string, number>; topTools: { name: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = organizationId ? `?organizationId=${organizationId}` : "";
    fetch(`/api/tasky-usage${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!data || data.totalQueries === 0) {
    return <div className="text-center py-8 text-muted-foreground">Sin datos aún. Usa Ledy para empezar a generar métricas.</div>;
  }

  const toolsPerQuery = data.totalQueries > 0 ? (data.totalTools / data.totalQueries).toFixed(1) : "0";
  const maxToolCount = data.topTools[0]?.count || 1;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Zap className="h-5 w-5 mx-auto mb-1 text-amber-500" />
          <div className="text-2xl font-bold text-foreground">{data.totalQueries.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Consultas totales</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Wrench className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <div className="text-2xl font-bold text-foreground">{data.totalTools.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Tools ejecutadas</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <BarChart3 className="h-5 w-5 mx-auto mb-1 text-purple-500" />
          <div className="text-2xl font-bold text-foreground">{toolsPerQuery}</div>
          <div className="text-xs text-muted-foreground">Tools/consulta</div>
        </div>
      </div>
      {data.topTools.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Tools más usadas</h4>
          <div className="space-y-2">
            {data.topTools.map((tool, i) => (
              <div key={tool.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-foreground w-36 truncate">{tool.name}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full ${TOOL_COLORS[i % TOOL_COLORS.length]}`} style={{ width: `${(tool.count / maxToolCount) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{tool.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
