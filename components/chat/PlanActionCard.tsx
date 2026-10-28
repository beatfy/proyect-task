"use client";

import React, { useState } from "react";
import { Rocket, CheckCircle2, ChevronDown, ChevronUp, Loader2, ArrowRight, Layers, CheckSquare, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PlanData } from "@/lib/plan-executor";

interface PlanActionCardProps {
  planData: PlanData;
  projectId?: string | null;
}

export default function PlanActionCard({ planData, projectId }: PlanActionCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [executedResult, setExecutedResult] = useState<{
    url: string;
    pipelineName: string;
    projectName: string;
    totalTasks: number;
    totalSubtasks: number;
  } | null>(null);

  if (!planData || !planData.phases || !Array.isArray(planData.phases)) {
    return null;
  }

  const totalPhases = planData.phases.length;
  const totalTasks = planData.phases.reduce((acc, p) => acc + (p.tasks?.length || 0), 0);
  const totalSubtasks = planData.phases.reduce(
    (acc, p) => acc + (p.tasks?.reduce((tAcc, t) => tAcc + (t.subtasks?.length || 0), 0) || 0),
    0
  );

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/execute-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planData,
          projectId: projectId || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al cargar el plan");
      }

      const data = await res.json();
      setExecutedResult({
        url: data.url,
        pipelineName: data.pipelineName,
        projectName: data.projectName,
        totalTasks: data.totalTasks,
        totalSubtasks: data.totalSubtasks,
      });

      toast.success("¡Plan cargado con éxito!", {
        description: `Se crearon ${data.totalTasks} tareas y ${data.totalSubtasks} subtareas en "${data.pipelineName}".`,
      });
    } catch (err: any) {
      console.error("Execute plan error:", err);
      toast.error(err.message || "No se pudo cargar el plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background p-5 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d95d39] to-[#e27d5f] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Plan de Proyecto Listo
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground mt-0.5">
              {planData.pipelineName || "Plan de Negocio"}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <span>{expanded ? "Ocultar fases" : "Ver detalle"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {planData.description && (
        <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
          {planData.description}
        </p>
      )}

      {/* Metrics Badges */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div className="rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Fases</span>
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">{totalPhases}</span>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium">
            <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
            <span>Tareas</span>
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">{totalTasks}</span>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/60 p-2">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-green-500" />
            <span>Subtareas</span>
          </div>
          <span className="text-base font-bold text-foreground mt-0.5 block">{totalSubtasks}</span>
        </div>
      </div>

      {/* Expanded Accordion Preview */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-3 animate-in fade-in duration-200">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Estructura de Fases y Tareas:
          </span>
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {planData.phases.map((phase, pIdx) => (
              <div key={pIdx} className="rounded-xl border border-border/40 bg-card p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: phase.color || "#3b82f6" }}
                  />
                  <h4 className="text-xs font-bold text-foreground">{phase.name}</h4>
                  <span className="text-[10px] text-muted-foreground">({phase.tasks?.length || 0} tareas)</span>
                </div>
                <ul className="space-y-1 pl-4">
                  {phase.tasks?.map((t, tIdx) => (
                    <li key={tIdx} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <div className="flex-1">
                        <span className="font-medium">{t.title}</span>
                        {t.subtasks && t.subtasks.length > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                            ({t.subtasks.length} subtareas)
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action / Result */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-3">
        {executedResult ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Cargado en {executedResult.projectName}</span>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(executedResult.url)}
              className="bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs gap-1.5 shadow-sm"
            >
              <span>Abrir Tablero</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Se creará un pipeline dedicado en tu proyecto con todas las tareas y subtareas.
            </p>
            <Button
              onClick={handleExecute}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-br from-[#d95d39] to-[#e27d5f] hover:opacity-90 text-white rounded-xl text-xs font-semibold px-4 py-2 gap-2 shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cargando en el tablero...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Cargar Plan en el Tablero</span>
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
