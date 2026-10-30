"use client";

import React, { useState, useEffect, useRef } from "react";
import { Timer, Play, Square, Loader2, X, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface ActiveTimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  description?: string | null;
  task?: {
    id: string;
    title: string;
  };
}

interface TaskOption {
  id: string;
  title: string;
  project?: { name: string } | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function GlobalTimer() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimeEntry | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [openStartModal, setOpenStartModal] = useState(false);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [searchTask, setSearchTask] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveTimer = async () => {
    try {
      const res = await fetch("/api/time-entries?userId=me");
      if (res.ok) {
        const entries: (ActiveTimeEntry & { endTime?: string | null })[] = await res.json();
        const running = entries.find((e) => !e.endTime);
        if (running) {
          setActiveTimer(running);
          const elapsed = Math.max(
            0,
            Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000)
          );
          setSeconds(elapsed);
        } else {
          setActiveTimer(null);
          setSeconds(0);
        }
      }
    } catch {
      // Ignore network errors on background poll
    }
  };

  useEffect(() => {
    fetchActiveTimer();

    const handleTimerChange = () => {
      fetchActiveTimer();
    };

    window.addEventListener("timer-change", handleTimerChange);
    return () => {
      window.removeEventListener("timer-change", handleTimerChange);
    };
  }, []);

  useEffect(() => {
    if (activeTimer) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSeconds(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer]);

  const handleStop = async () => {
    if (!activeTimer) return;
    setStopping(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeTimer.id, action: "stop" }),
      });
      if (res.ok) {
        const stopped = await res.json();
        const durationFormatted = formatDuration(stopped.duration || seconds);
        toast.success(`Cronómetro detenido — ${durationFormatted} registrados`);
        setActiveTimer(null);
        setSeconds(0);
        window.dispatchEvent(new CustomEvent("timer-change"));
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al detener cronómetro");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setStopping(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      toast.error("Error al cargar tareas");
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenStartDialog = () => {
    setOpenStartModal(true);
    loadTasks();
  };

  const handleStartOnTask = async (taskId: string) => {
    setStarting(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "start" }),
      });
      if (res.ok) {
        const created = await res.json();
        setActiveTimer(created);
        setSeconds(0);
        setOpenStartModal(false);
        toast.success("Cronómetro iniciado");
        window.dispatchEvent(new CustomEvent("timer-change"));
      } else {
        const err = await res.json();
        toast.error(err.error || "No se pudo iniciar el cronómetro");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setStarting(false);
    }
  };

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(searchTask.toLowerCase())
  );

  return (
    <>
      {/* Floating Widget at bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
        {activeTimer ? (
          <div className="flex items-center gap-3 bg-slate-900/95 dark:bg-slate-950/95 text-white px-3.5 py-2 rounded-full shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>

            <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-emerald-400">
              {formatDuration(seconds)}
            </span>

            <div className="h-3.5 w-px bg-slate-700" />

            <Link
              href={`/tasks?openTask=${activeTimer.taskId}`}
              className="text-xs text-slate-200 hover:text-white max-w-[130px] sm:max-w-[200px] truncate hover:underline"
              title={activeTimer.task?.title || "Ver tarea"}
            >
              {activeTimer.task?.title || "Tarea activa"}
            </Link>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={stopping}
              className="h-6 px-2 text-xs rounded-full ml-1 gap-1"
              title="Detener cronómetro y guardar tiempo"
            >
              {stopping ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Square className="h-3 w-3 fill-current" />
              )}
              <span className="hidden sm:inline">Parar</span>
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenStartDialog}
            className="h-9 px-3 rounded-full bg-background/90 backdrop-blur-md shadow-md border-border text-foreground hover:bg-accent text-xs gap-1.5"
            title="Iniciar registro manual de tiempo"
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline font-medium">Cronómetro</span>
          </Button>
        )}
      </div>

      {/* Dialog to manually pick a task and start timer */}
      <Dialog open={openStartModal} onOpenChange={setOpenStartModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Iniciar Cronómetro Manual
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona la tarea en la que vas a trabajar para registrar el tiempo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input
              placeholder="Buscar tarea..."
              value={searchTask}
              onChange={(e) => setSearchTask(e.target.value)}
              className="text-xs"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border rounded-md p-1.5 border-border">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando tareas...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No se encontraron tareas abiertas
                </div>
              ) : (
                filteredTasks.slice(0, 20).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleStartOnTask(t.id)}
                    disabled={starting}
                    className="w-full text-left p-2 rounded-md hover:bg-accent text-xs flex items-center justify-between group transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-foreground truncate">{t.title}</p>
                      {t.project && (
                        <p className="text-[10px] text-muted-foreground truncate">{t.project.name}</p>
                      )}
                    </div>
                    <Play className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
