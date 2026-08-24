"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, AlertCircle, Loader2, FolderOpen, TrendingUp, BarChart3, Building2, Bot, Wrench, Zap, Timer, Flame, Sparkles, ArrowRight, Droplets } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/lib/organization-context";

interface BriefingData {
  fastingInfo: {
    active: boolean;
    protocol?: string;
    elapsedHours?: number;
    targetHours?: number;
    progressPercent?: number;
    phase?: string;
    phaseIcon?: string;
    isFocusPeak?: boolean;
    waterDrankMl: number;
    waterGoalMl: number;
  };
  topTasks: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    status: string;
    project: {
      id: string;
      name: string;
      color: string;
    } | null;
  }>;
  recommendation: string;
}

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
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { organizations, selectedOrg, setSelectedOrg, loading: orgLoading } = useOrganization();

  useEffect(() => {
    if (!orgLoading) {
      fetchStats();
      fetchBriefing();
    }
  }, [selectedOrg, orgLoading]);

  const fetchBriefing = async () => {
    try {
      const res = await fetch("/api/dashboard/briefing");
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch (e) {
      console.error("Error loading briefing:", e);
    }
  };

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

      {/* Morning Briefing Widget (Ayuno + Top Tareas + Recomendación) */}
      {briefing && (
        <Card className="border-emerald-500/25 shadow-md bg-gradient-to-br from-card via-card to-emerald-500/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <CardContent className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Resumen de Salud & Recomendación */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Briefing de Enfoque Diario</span>
                  </div>

                  {briefing.fastingInfo.active ? (
                    <Link
                      href="/fasting"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition-colors"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>
                        Ayuno en curso: {briefing.fastingInfo.elapsedHours}h ({briefing.fastingInfo.phase})
                      </span>
                    </Link>
                  ) : (
                    <Link
                      href="/fasting"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>Sin ayuno activo · Iniciar hoy</span>
                    </Link>
                  )}

                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                    <Droplets className="w-3 h-3" />
                    <span>{briefing.fastingInfo.waterDrankMl}ml agua</span>
                  </span>
                </div>

                <p className="text-sm text-foreground font-medium leading-relaxed">
                  {briefing.recommendation}
                </p>
              </div>

              {/* Top 3 Tareas Prioritarias */}
              <div className="bg-muted/40 p-3.5 rounded-2xl border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>🎯 Prioridades de Hoy</span>
                  <Link href="/tasks" className="text-primary hover:underline flex items-center gap-0.5 text-[11px]">
                    <span>Ver todas</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {briefing.topTasks.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    ¡Estás al día! No tienes tareas pendientes urgentes.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {briefing.topTasks.map((t) => (
                      <Link
                        key={t.id}
                        href="/tasks"
                        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted transition-colors text-xs group"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="font-medium text-foreground truncate flex-1">{t.title}</span>
                        {t.priority === "URGENT" || t.priority === "HIGH" ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold shrink-0">
                            Alta
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
