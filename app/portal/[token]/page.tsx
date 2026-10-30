"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Calendar,
  Receipt,
  Download,
  AlertCircle,
  Loader2,
  FolderOpen,
  Kanban,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  stage?: Stage | null;
}

interface InvoiceItem {
  id: string;
  month: number;
  year: number;
  amount: number;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  dueDate: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  clientEmail: string | null;
  clientContext: string | null;
  createdAt: string;
  taskPipelines?: {
    stages: Stage[];
  }[];
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const priorityLabels: Record<string, string> = {
  NONE: "Normal",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
  PAID: { label: "Pagada", color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300" },
  PENDING: { label: "Pendiente", color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300" },
  OVERDUE: { label: "Vencida", color: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300" },
  CANCELLED: { label: "Cancelada", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300" },
};

export default function ClientPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/portal/${token}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setTasks(data.tasks || []);
        setInvoices(data.invoices || []);
      } else {
        const err = await res.json();
        setError(err.error || "Portal no disponible");
      }
    } catch {
      setError("Error al conectar con el portal");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token, fetchPortalData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Cargando portal del cliente...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full text-center p-6 border-border">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Acceso no disponible</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {error || "El enlace no es válido o ha expirado. Contacta con tu responsable de proyecto."}
          </p>
        </Card>
      </div>
    );
  }

  const completedCount = tasks.filter(
    (t) => t.status === "DONE" || t.status === "COMPLETED" || t.stage?.name?.toLowerCase().includes("hecho")
  ).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const defaultStages: Stage[] = [
    { id: "TODO", name: "Por hacer", color: "#64748b", position: 0 },
    { id: "INPROGRESS", name: "En progreso", color: "#3b82f6", position: 1 },
    { id: "INREVIEW", name: "En revisión", color: "#eab308", position: 2 },
    { id: "DONE", name: "Hecho", color: "#22c55e", position: 3 },
  ];

  const projectStages =
    project.taskPipelines?.[0]?.stages && project.taskPipelines[0].stages.length > 0
      ? project.taskPipelines[0].stages
      : defaultStages;

  const getTasksForStage = (stage: Stage) => {
    return tasks.filter((t) => {
      if (t.stage?.id === stage.id) return true;
      if (t.stage?.name && t.stage.name.toLowerCase() === stage.name.toLowerCase()) return true;
      if (stage.position === 3 && (t.status === "DONE" || t.status === "COMPLETED")) return true;
      if (stage.position === 1 && (t.status === "INPROGRESS" || t.status === "EN PROGRESO")) return true;
      if (stage.position === 2 && (t.status === "INREVIEW" || t.status === "REVISION")) return true;
      if (stage.position === 0 && !["INPROGRESS", "INREVIEW", "DONE", "COMPLETED"].includes(t.status)) return true;
      return false;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: project.color }} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
              {project.name}
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Portal de Seguimiento del Cliente
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs border-border">
          {project.status === "ACTIVE" ? "Activo" : project.status}
        </Badge>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Project Overview Card */}
        <Card className="bg-white dark:bg-slate-900 border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumen del Proyecto
                </span>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {project.description || "Seguimiento transparente de entregas, avance de tareas y facturación."}
                </p>
              </div>

              {/* Progress Metric */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border min-w-[260px]">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Progreso general</span>
                    <span className="font-bold text-primary">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    {completedCount} de {totalCount} tareas completadas
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed View */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="bg-slate-100 dark:bg-slate-850 p-1 border border-border">
            <TabsTrigger value="tasks" className="text-xs gap-1.5">
              <Kanban className="h-3.5 w-3.5" />
              <span>Avance de Entregables ({totalCount})</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              <span>Facturas ({invoices.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* TASKS VIEW */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {projectStages.map((stage) => {
                const stageTasks = getTasksForStage(stage);
                return (
                  <div
                    key={stage.id}
                    className="flex flex-col bg-slate-100/60 dark:bg-slate-900/40 rounded-xl p-3 border border-border min-h-[380px]"
                  >
                    <div className="flex items-center justify-between pb-3 px-1 border-b border-border mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                          {stage.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {stageTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                      {stageTasks.length === 0 ? (
                        <div className="text-center py-10 text-xs text-muted-foreground/60">
                          Sin entregables
                        </div>
                      ) : (
                        stageTasks.map((task) => (
                          <Card
                            key={task.id}
                            className="bg-white dark:bg-slate-850 border-border shadow-xs hover:shadow-sm transition-shadow"
                          >
                            <CardContent className="p-3.5 space-y-2">
                              <h4 className="font-medium text-xs text-foreground leading-snug">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40 text-[10px]">
                                {task.priority !== "NONE" && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                    {priorityLabels[task.priority] || task.priority}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-muted-foreground flex items-center gap-1 ml-auto">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(task.dueDate).toLocaleDateString("es-ES", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* INVOICES VIEW */}
          <TabsContent value="invoices" className="space-y-4">
            {invoices.length === 0 ? (
              <Card className="bg-white dark:bg-slate-900 border-border text-center py-12">
                <CardContent className="space-y-2">
                  <Receipt className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No hay facturas registradas</p>
                  <p className="text-xs text-muted-foreground">
                    Las facturas emitidas para este proyecto aparecerán aquí para su consulta y descarga.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const cfg = invoiceStatusConfig[inv.status] || invoiceStatusConfig.PENDING;
                  return (
                    <Card
                      key={inv.id}
                      className="bg-white dark:bg-slate-900 border-border hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm text-foreground">
                            Factura {monthNames[inv.month - 1]} {inv.year}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimiento:{" "}
                            {new Date(inv.dueDate).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-foreground">
                            {inv.amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                          </span>
                          <Badge className={cn("text-xs border", cfg.color)}>{cfg.label}</Badge>
                          <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
                            <a href={`/api/billing/invoices/${inv.id}/pdf`} download>
                              <Download className="h-3.5 w-3.5" />
                              <span>Descargar PDF</span>
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-border text-center text-xs text-muted-foreground bg-white dark:bg-slate-900">
        <p>Portal seguro provisto por la agencia responsable de {project.name}.</p>
      </footer>
    </div>
  );
}
