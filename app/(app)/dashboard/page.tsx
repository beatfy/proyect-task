"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, CheckCircle, AlertCircle, Loader2, FolderOpen, TrendingUp, BarChart3, Building2, Bot, Wrench, Zap, Sparkles } from "lucide-react";
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
  TODO: "bg-slate-500 shadow-sm shadow-slate-500/50",
  INPROGRESS: "bg-indigo-500 shadow-sm shadow-indigo-500/50",
  INREVIEW: "bg-amber-500 shadow-sm shadow-amber-500/50",
  DONE: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const priorityColors: Record<string, string> = {
  NONE: "bg-slate-500",
  LOW: "bg-slate-400",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-indigo-500",
  URGENT: "bg-rose-500 animate-pulse",
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Cargando métricas...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400 font-medium">Error al cargar estadísticas</p>
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
      icon: CheckCircle, 
      color: "text-emerald-400", 
      badgeVariant: "emerald" as const,
      glow: "hover:border-emerald-500/30"
    },
    { 
      name: "Completadas este mes", 
      value: stats.completedThisMonth, 
      icon: TrendingUp, 
      color: "text-indigo-400", 
      badgeVariant: "indigo" as const,
      change: monthChange,
      glow: "hover:border-indigo-500/30"
    },
    { 
      name: "Proyectos activos", 
      value: stats.activeProjects, 
      icon: FolderOpen, 
      color: "text-violet-400", 
      badgeVariant: "indigo" as const,
      glow: "hover:border-violet-500/30"
    },
    { 
      name: "Tareas vencidas", 
      value: stats.overdueTasks, 
      icon: AlertCircle, 
      color: "text-rose-400", 
      badgeVariant: "crimson" as const,
      glow: "hover:border-rose-500/40"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="indigo">
                <Sparkles className="h-3 w-3 mr-1" /> SaaS Overview
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              ¡Hola, {session?.user?.name || "Usuario"}!
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Monitoreo en tiempo real de tu rendimiento y espacio de trabajo
            </p>
          </div>
          {organizations.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 px-3 rounded-2xl border border-white/10">
              <Building2 className="h-4 w-4 text-indigo-400" />
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-[180px] border-none bg-transparent text-white focus:ring-0">
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10">
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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className={`glass-card ${stat.glow} transition-all duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-widest font-bold text-slate-400">
                {stat.name}
              </CardTitle>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-white mt-1">{stat.value}</div>
              {stat.change !== undefined && (
                <div className="mt-2">
                  <Badge variant={stat.change >= 0 ? "emerald" : "crimson"}>
                    {stat.change >= 0 ? "↑" : "↓"} {Math.abs(stat.change)}% vs mes previo
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Doc Metrics */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Bot className="h-5 w-5 text-indigo-400" />
            </div>
            <span>Métricas de Doc (Agente IA)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocMetrics organizationId={selectedOrg === "all" ? null : selectedOrg} />
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <span>Tareas por Estado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusLabels).map(([key, label]) => {
                const count = stats.tasksByStatus[key] || 0;
                const percentage = Math.round((count / totalByStatus) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[key]}`} />
                        <span className="text-sm font-semibold text-slate-200">{label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-white/5">
                      <div
                        className={`h-2 rounded-full ${statusColors[key]} transition-all duration-500`}
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
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <BarChart3 className="h-5 w-5 text-amber-400" />
              </div>
              <span>Tareas por Prioridad</span>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[key]}`} />
                        <span className="text-sm font-semibold text-slate-200">{label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-white/5">
                      <div
                        className={`h-2 rounded-full ${priorityColors[key]} transition-all duration-500`}
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

const TOOL_COLORS = ["bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

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
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;
  }

  if (!data || data.totalQueries === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">Sin datos aún. Interactúa con Doc para ver analíticas en tiempo real.</div>;
  }

  const toolsPerQuery = data.totalQueries > 0 ? (data.totalTools / data.totalQueries).toFixed(1) : "0";
  const maxToolCount = data.topTools[0]?.count || 1;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <Zap className="h-5 w-5 mx-auto mb-1.5 text-amber-400" />
          <div className="text-2xl font-black text-white">{data.totalQueries.toLocaleString()}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Consultas totales</div>
        </div>
        <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <Wrench className="h-5 w-5 mx-auto mb-1.5 text-indigo-400" />
          <div className="text-2xl font-black text-white">{data.totalTools.toLocaleString()}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Tools ejecutadas</div>
        </div>
        <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <BarChart3 className="h-5 w-5 mx-auto mb-1.5 text-violet-400" />
          <div className="text-2xl font-black text-white">{toolsPerQuery}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Tools/consulta</div>
        </div>
      </div>
      {data.topTools.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3">Tools más ejecutadas</h4>
          <div className="space-y-2.5">
            {data.topTools.map((tool, i) => (
              <div key={tool.name} className="flex items-center gap-3">
                <span className="text-xs font-mono font-medium text-slate-300 w-36 truncate">{tool.name}</span>
                <div className="flex-1 bg-slate-800/60 rounded-full h-2 overflow-hidden border border-white/5">
                  <div className={`h-2 rounded-full ${TOOL_COLORS[i % TOOL_COLORS.length]}`} style={{ width: `${(tool.count / maxToolCount) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-400 w-10 text-right">{tool.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
