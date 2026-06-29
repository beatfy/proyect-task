"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Split,
  Sparkles,
  Plus,
  X,
  Flame,
  Zap,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronLeft,
  CheckCircle2,
  ListTodo,
  Calendar,
  AlertTriangle,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string | null;
  project?: { id: string; name: string; color: string } | null;
  tdahMetrics?: {
    emotionalWeight: number;
    baseWeight: number;
    energyRequired: "low" | "medium" | "high";
    timeBlock: string;
    blocksSomeone: boolean;
    dopamineSource: "routine" | "social" | "creative" | "problem-solving";
    lastTouched: string;
    streakDays: number;
    isPromoted: boolean;
    blockReason?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalAttentionDebt: number;
  streakAlerts: number;
  highestLoadProject: {
    id: string;
    name: string;
    color: string;
    load: number;
  } | null;
  weeklyTrend: {
    currentWeekLoad: number;
    prevWeekLoad: number;
    percentage: number;
    direction: "up" | "down";
  };
}

interface DopaminePrimer {
  id: string;
  title: string;
  description?: string;
  type: "creative" | "social" | "problem-solving";
  duration: string;
  isSystem: boolean;
  taskId?: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function FocusFlowPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State Variables
  const [focusQueue, setFocusQueue] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [primers, setPrimers] = useState<DopaminePrimer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [energyFilter, setEnergyFilter] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isPrimersLoading, setIsPrimersLoading] = useState(true);

  // Active Focus Session State
  const [currentFocusTask, setCurrentFocusTask] = useState<Task | null>(null);
  const [isPrimerSession, setIsPrimerSession] = useState(false);
  const [primerDetails, setPrimerDetails] = useState<{ title: string; type: string } | null>(null);
  
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modal States
  const [isMicroSplitOpen, setIsMicroSplitOpen] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState<Task | null>(null);
  const [splitSteps, setSplitSteps] = useState<string[]>(["", ""]);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newWeight, setNewWeight] = useState<number>(3);
  const [newEnergy, setNewEnergy] = useState<"low" | "medium" | "high">("medium");
  const [newTimeBlock, setNewTimeBlock] = useState<string>("30min");
  const [newBlocksSomeone, setNewBlocksSomeone] = useState<boolean>(false);
  const [newDopamineSource, setNewDopamineSource] = useState<"routine" | "social" | "creative" | "problem-solving">("routine");
  const [newStatus, setNewStatus] = useState<string>("TODO"); // planning or TODO
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Parse time blocks like "15min", "30min" to seconds
  const parseTimeBlock = (timeBlockStr: string | undefined): number => {
    if (!timeBlockStr) return 30 * 60;
    const mins = parseInt(timeBlockStr);
    return isNaN(mins) ? 30 * 60 : mins * 60;
  };

  // Fetch Focus Queue
  const fetchFocusQueue = useCallback(async (energy = energyFilter) => {
    try {
      setIsLoading(true);
      const url = energy !== "all" 
        ? `/api/tasks/tdah-queue?energy=${energy}` 
        : "/api/tasks/tdah-queue";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFocusQueue(data);
      } else {
        toast.error("Error al cargar la cola de enfoque");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error de red al cargar la cola");
    } finally {
      setIsLoading(false);
    }
  }, [energyFilter]);

  // Fetch ADHD Stats
  const fetchStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const res = await fetch("/api/tasks/tdah-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch Dopamine Primers
  const fetchPrimers = useCallback(async () => {
    try {
      setIsPrimersLoading(true);
      const res = await fetch("/api/tasks/dopamine-primer");
      if (res.ok) {
        const data = await res.json();
        setPrimers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPrimersLoading(false);
    }
  }, []);

  // Fetch Projects for Selector
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Load Initial Data
  useEffect(() => {
    fetchFocusQueue();
    fetchStats();
    fetchPrimers();
    fetchProjects();
  }, [fetchFocusQueue, fetchStats, fetchPrimers, fetchProjects]);

  // Handle energy filter changes
  useEffect(() => {
    fetchFocusQueue(energyFilter);
  }, [energyFilter, fetchFocusQueue]);

  // Sound Synthesizer Chime
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch (e) {
      console.error("Audio failed", e);
    }
  };

  // Timer Tick Interval Manager
  useEffect(() => {
    if (timerActive) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            // Timer Finished
            setTimerActive(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            playChime();
            toast.success("¡Sesión completada! Has mantenido el enfoque.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive]);

  // Start Focus Mode with a task
  const handleStartFocus = (task: Task) => {
    setCurrentFocusTask(task);
    setIsPrimerSession(false);
    setPrimerDetails(null);
    const secs = parseTimeBlock(task.tdahMetrics?.timeBlock);
    setTimerSeconds(secs);
    setTotalDuration(secs);
    setTimerActive(true);
  };

  // Start Focus Mode with a Dopamine Primer
  const handleStartPrimer = (primer: DopaminePrimer) => {
    setIsPrimerSession(true);
    setPrimerDetails({ title: primer.title, type: primer.type });
    setCurrentFocusTask(null);
    const secs = parseTimeBlock(primer.duration);
    setTimerSeconds(secs);
    setTotalDuration(secs);
    setTimerActive(true);
  };

  // Exit Focus mode
  const handleExitFocus = () => {
    if (confirm("¿Seguro que deseas salir del modo enfoque? Se perderá el temporizador actual.")) {
      setTimerActive(false);
      setCurrentFocusTask(null);
      setIsPrimerSession(false);
      setPrimerDetails(null);
      fetchFocusQueue();
      fetchStats();
    }
  };

  // Update TDAH progress and time tracked
  const handleUpdateProgress = async (status: "hecha" | "aliviada" | "sigue_pesando") => {
    if (!currentFocusTask) return;

    const elapsedSeconds = totalDuration - timerSeconds;
    const timeSpentMinutes = Math.max(0, Math.round(elapsedSeconds / 60));

    try {
      const res = await fetch(`/api/tasks/${currentFocusTask.id}/tdah-progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          timeSpent: timeSpentMinutes,
          emotionalWeight: currentFocusTask.tdahMetrics?.emotionalWeight
        })
      });

      if (res.ok) {
        toast.success(
          status === "hecha" 
            ? "¡Tarea marcada como completada!" 
            : status === "aliviada" 
              ? "Carga emocional reducida. ¡Buen avance!" 
              : "Progreso guardado. Seguiremos trabajando en ella."
        );
        
        // Reset states
        setTimerActive(false);
        setCurrentFocusTask(null);
        
        // Refresh data
        fetchFocusQueue();
        fetchStats();
        fetchPrimers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al actualizar progreso");
      }
    } catch (e) {
      toast.error("Error de conexión al actualizar progreso");
    }
  };

  // Handle Micro Split Submit
  const handleMicroSplitSubmit = async () => {
    if (!selectedTaskForSplit) return;
    
    const validSteps = splitSteps.filter(s => s.trim() !== "");
    if (validSteps.length === 0) {
      toast.error("Por favor, introduce al menos un paso.");
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${selectedTaskForSplit.id}/micro-split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: validSteps })
      });

      if (res.ok) {
        toast.success(`Tarea dividida con éxito en ${validSteps.length} sub-pasos.`);
        setIsMicroSplitOpen(false);
        setSplitSteps(["", ""]);
        setSelectedTaskForSplit(null);
        fetchFocusQueue();
        fetchStats();
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al realizar micro-división");
      }
    } catch (e) {
      toast.error("Error al conectar con el servidor para la micro-división");
    }
  };

  // Handle Create Task Submit
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    setIsSubmittingTask(true);
    try {
      const payload = {
        title: newTitle,
        description: newDesc || null,
        status: newStatus,
        projectId: newProjectId || null,
        tdahMetrics: {
          emotionalWeight: newWeight,
          baseWeight: newWeight,
          energyRequired: newEnergy,
          timeBlock: newTimeBlock,
          blocksSomeone: newBlocksSomeone,
          dopamineSource: newDopamineSource,
          lastTouched: new Date().toISOString(),
          streakDays: 0,
          blockReason: newBlockReason || null
        }
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Tarea de enfoque creada con éxito");
        setIsCreateTaskOpen(false);
        // Reset inputs
        setNewTitle("");
        setNewDesc("");
        setNewBlockReason("");
        setNewProjectId("");
        setNewWeight(3);
        setNewEnergy("medium");
        setNewTimeBlock("30min");
        setNewBlocksSomeone(false);
        setNewDopamineSource("routine");
        setNewStatus("TODO");
        
        fetchFocusQueue();
        fetchStats();
      } else {
        toast.error(data.error || "Error al crear la tarea");
      }
    } catch (e) {
      toast.error("Error de red al crear la tarea");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Helper to get weight gradient background colors for Focus Screen & Cards
  const getWeightColorStyles = (weight: number) => {
    if (weight <= 1.5) {
      return {
        bg: "from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/20 dark:to-teal-950/20",
        border: "border-emerald-200 dark:border-emerald-800/40",
        text: "text-emerald-800 dark:text-emerald-300",
        pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        themeColor: "#10b981",
        label: "Mentalmente Liviana"
      };
    }
    if (weight <= 2.5) {
      return {
        bg: "from-sky-50/90 to-blue-50/90 dark:from-sky-950/20 dark:to-blue-950/20",
        border: "border-blue-200 dark:border-blue-800/40",
        text: "text-blue-800 dark:text-blue-300",
        pill: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        themeColor: "#3b82f6",
        label: "Normal / Manejable"
      };
    }
    if (weight <= 3.5) {
      return {
        bg: "from-amber-50/90 to-orange-50/90 dark:from-amber-950/20 dark:to-orange-950/20",
        border: "border-amber-200 dark:border-amber-800/40",
        text: "text-amber-800 dark:text-amber-300",
        pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
        themeColor: "#f59e0b",
        label: "Moderadamente Pesada"
      };
    }
    if (weight <= 4.5) {
      return {
        bg: "from-orange-50/90 to-rose-50/90 dark:from-orange-950/20 dark:to-rose-950/20",
        border: "border-orange-200 dark:border-orange-800/40",
        text: "text-orange-800 dark:text-orange-300",
        pill: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
        themeColor: "#f97316",
        label: "Muy Pesada"
      };
    }
    return {
      bg: "from-red-50/95 to-rose-100/95 dark:from-red-950/30 dark:to-rose-950/30",
      border: "border-red-300 dark:border-red-800/60",
      text: "text-red-900 dark:text-red-200",
      pill: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
      themeColor: "#ef4444",
      label: "Bloqueo Emocional Extremo"
    };
  };

  // Helper to customize sizing and styles for queue task cards
  const getCardScaleAndStyle = (weight: number, streakDays: number) => {
    let sizeClass = "p-4 sm:p-5 text-base";
    let borderClass = "border border-border/50 hover:border-border";
    let pulseClass = "";
    let opacityClass = "";

    if (weight <= 1.5) {
      // Alleviated / Light (Slight opacity reduction and micro-blur to indicate low priority)
      sizeClass = "p-3 sm:p-4 text-sm opacity-65 dark:opacity-50 saturate-50 blur-[0.2px] hover:opacity-100 hover:saturate-100 hover:blur-none transition-all duration-300";
    } else if (weight >= 4.5) {
      // Heavy/Critical (Larger font, thicker border, larger padding)
      sizeClass = "p-6 sm:p-7 text-lg font-extrabold";
      borderClass = "border-2 border-red-500/50 dark:border-red-500/60 shadow-lg shadow-red-500/5";
    }

    if (streakDays > 3) {
      borderClass = "border-2 border-red-500 dark:border-red-500";
      pulseClass = "animate-pulse-subtle";
    }

    return {
      wrapperClass: cn("transition-all duration-300 overflow-hidden", borderClass, pulseClass, opacityClass),
      sizeClass
    };
  };

  // Format Seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Circular progress math
  const getCircleStrokeProps = () => {
    const radius = 95;
    const stroke = 8;
    const circumference = 2 * Math.PI * radius;
    const remainingPercentage = totalDuration > 0 ? (timerSeconds / totalDuration) * 100 : 0;
    const strokeDashoffset = circumference - (remainingPercentage / 100) * circumference;

    return {
      radius,
      stroke,
      circumference,
      strokeDashoffset
    };
  };

  // Renders the FULL SCREEN Focus Screen
  if (currentFocusTask || isPrimerSession) {
    const taskTitle = currentFocusTask ? currentFocusTask.title : (primerDetails?.title || "Dopamine Booster");
    const taskDesc = currentFocusTask ? currentFocusTask.description : "Una pequeña actividad para recargar tu dopamina y enfocar tu atención.";
    const weight = currentFocusTask?.tdahMetrics?.emotionalWeight || 1;
    const colors = getWeightColorStyles(weight);
    const { radius, stroke, circumference, strokeDashoffset } = getCircleStrokeProps();

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 font-sans p-6 overflow-hidden">
        {/* CSS Keyframes injected inline safely */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse-subtle {
            0%, 100% {
              box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35);
            }
            50% {
              box-shadow: 0 0 0 7px rgba(239, 68, 68, 0.05);
            }
          }
          .animate-pulse-subtle {
            animation: pulse-subtle 1.8s infinite ease-in-out;
          }
        `}} />

        {/* Distraction Free Background Shapes */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />

        {/* Exit & Header */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <Button
            variant="ghost"
            onClick={handleExitFocus}
            className="text-slate-400 hover:text-slate-100 hover:bg-slate-900"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Salir de Enfoque
          </Button>
          <div className="flex items-center gap-2 text-slate-400 text-xs tracking-wider uppercase">
            <Zap className={cn("h-4 w-4 text-amber-400", timerActive && "animate-pulse")} />
            {isPrimerSession ? "Activador Dopamina" : "Modo Focus Activo"}
          </div>
        </div>

        {/* Center Task Container */}
        <div className="max-w-xl w-full flex flex-col items-center justify-center text-center space-y-8 z-10">
          {/* Card detailing the task */}
          <div className={cn(
            "w-full rounded-2xl border p-6 text-left transition-all duration-500 bg-gradient-to-br",
            colors.bg,
            colors.border
          )}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <Badge variant="outline" className={cn("border-none px-2.5 py-0.5", colors.pill)}>
                {isPrimerSession ? `DOPAMINA: ${primerDetails?.type}` : `CARGA: ${colors.label}`}
              </Badge>
              {currentFocusTask?.project && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: currentFocusTask.project.color || "#6366f1" }}
                  />
                  {currentFocusTask.project.name}
                </div>
              )}
            </div>

            <h1 className={cn("text-2xl font-bold tracking-tight mb-2", colors.text)}>
              {taskTitle}
            </h1>
            
            {taskDesc && (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                {taskDesc}
              </p>
            )}

            {/* What Blocks Me - Friction Log displayed directly to tackle it */}
            {!isPrimerSession && currentFocusTask?.tdahMetrics?.blockReason && (
              <div className="mt-4 bg-slate-950/40 dark:bg-slate-900/50 border border-slate-500/10 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-350 italic">
                <span className="font-bold text-[var(--mediterranean-terracotta)] not-italic block mb-0.5">🧠 Fricción identificada:</span>
                &ldquo;{currentFocusTask.tdahMetrics.blockReason}&rdquo;
              </div>
            )}
          </div>

          {/* Interactive Circular Timer */}
          <div className="relative flex items-center justify-center w-64 h-64 select-none">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="128"
                cy="128"
                r={radius}
                className="text-slate-900"
                strokeWidth={stroke}
                stroke="currentColor"
                fill="transparent"
              />
              {/* Colored Progress Circle */}
              <circle
                cx="128"
                cy="128"
                r={radius}
                stroke={isPrimerSession ? "#10b981" : colors.themeColor}
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            
            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold tracking-tight text-white">
                {formatTime(timerSeconds)}
              </span>
              <span className="text-slate-500 text-xs uppercase tracking-widest mt-1">
                {timerActive ? "Enfocado" : "Pausado"}
              </span>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTimerSeconds(totalDuration)}
                className="w-12 h-12 rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Reiniciar temporizador"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>

              <Button
                size="lg"
                onClick={() => setTimerActive(!timerActive)}
                className={cn(
                  "px-8 h-14 rounded-full text-white font-semibold transition-all shadow-lg",
                  timerActive 
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/10" 
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/10"
                )}
              >
                {timerActive ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" /> Pausar Sesión
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2 animate-pulse" /> Reanudar Enfoque
                  </>
                )}
              </Button>
            </div>

            {/* ADHD Micro-Splitter during session for extra assistance */}
            {!isPrimerSession && currentFocusTask && (
              <div className="pt-6 flex flex-wrap justify-center gap-3 w-full border-t border-slate-900">
                <Button
                  onClick={() => handleUpdateProgress("hecha")}
                  className="bg-emerald-600/90 text-white hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marcar Hecha
                </Button>
                <Button
                  onClick={() => handleUpdateProgress("aliviada")}
                  variant="outline"
                  className="border-blue-800 text-blue-400 bg-blue-950/20 hover:bg-blue-950/50 hover:text-blue-300"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Aliviar Carga (-2 pts)
                </Button>
                <Button
                  onClick={() => handleUpdateProgress("sigue_pesando")}
                  variant="outline"
                  className="border-amber-800 text-amber-400 bg-amber-950/20 hover:bg-amber-950/50 hover:text-amber-300"
                >
                  <Flame className="h-4 w-4 mr-2" />
                  Sigue Pesando (+0.5 pts)
                </Button>
              </div>
            )}

            {isPrimerSession && (
              <div className="pt-6 flex justify-center w-full border-t border-slate-900">
                <Button
                  onClick={() => {
                    setTimerActive(false);
                    setCurrentFocusTask(null);
                    setIsPrimerSession(false);
                    setPrimerDetails(null);
                    fetchFocusQueue();
                    fetchStats();
                    fetchPrimers();
                    toast.success("¡Activador de dopamina completado! Ahora estás listo para enfocar.");
                  }}
                  className="bg-emerald-600/90 text-white hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completar Activación
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Renders the MAIN DASHBOARD
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-1 md:p-3">
      {/* CSS Keyframes injected inline safely */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-subtle {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35);
          }
          50% {
            box-shadow: 0 0 0 7px rgba(239, 68, 68, 0.05);
          }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 1.8s infinite ease-in-out;
        }
      `}} />

      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient-terracotta flex items-center gap-2">
            <Brain className="h-8 w-8 text-[var(--mediterranean-terracotta)]" />
            Focus Flow
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestión de tareas basada en carga emocional y niveles de energía para mentes activas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCreateTaskOpen(true)}
            className="gradient-mediterranean text-white border-none shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea de Enfoque
          </Button>
        </div>
      </div>

      {/* Attention Stats Dashboard */}
      {isStatsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-card/50 border border-border/50 h-28" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Attention Debt Dial */}
          <Card className="card-mediterranean relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deuda de Atención</span>
                <Brain className="h-4 w-4 text-[var(--mediterranean-terracotta)]" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-foreground">{stats.totalAttentionDebt}</span>
                <span className="text-xs text-muted-foreground">puntos</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Suma de carga emocional de todas tus tareas activas.
              </p>
              {stats.totalAttentionDebt > 15 && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500/50" title="Carga alta" />
              )}
            </CardContent>
          </Card>

          {/* Streak Alerts */}
          <Card className="card-mediterranean relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas de Racha</span>
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-foreground">{stats.streakAlerts}</span>
                <span className="text-xs text-muted-foreground">tareas estancadas</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {stats.streakAlerts > 0 
                  ? "Tareas sin tocar por más de 3 días." 
                  : "¡Buen ritmo! Ninguna tarea estancada."}
              </p>
              {stats.streakAlerts > 0 && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-red-500/50" />
              )}
            </CardContent>
          </Card>

          {/* Highest Load Project */}
          <Card className="card-mediterranean">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proyecto más Pesado</span>
                <FolderOpen className="h-4 w-4 text-[var(--mediterranean-blue)]" />
              </div>
              <div className="mt-2 min-h-[36px] flex flex-col justify-center">
                {stats.highestLoadProject ? (
                  <>
                    <span className="text-base font-bold text-foreground truncate max-w-full">
                      {stats.highestLoadProject.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Carga: {stats.highestLoadProject.load} pts
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Ninguno</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                El proyecto que te exige mayor energía cognitiva.
              </p>
            </CardContent>
          </Card>

          {/* Weekly Trend */}
          <Card className="card-mediterranean">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tendencia Semanal</span>
                {stats.weeklyTrend.direction === "up" ? (
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-emerald-500" />
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={cn(
                  "text-3xl font-extrabold",
                  stats.weeklyTrend.percentage > 0 
                    ? "text-orange-500" 
                    : stats.weeklyTrend.percentage < 0 
                      ? "text-emerald-500" 
                      : "text-foreground"
                )}>
                  {stats.weeklyTrend.percentage > 0 ? "+" : ""}{stats.weeklyTrend.percentage}%
                </span>
                <span className="text-xs text-muted-foreground">esta semana</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Carga emocional añadida vs la semana anterior.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Focus Queue (Focus Window) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Ventana de Enfoque
              </h2>
              <Badge variant="outline" className="badge-mediterranean">
                Top 5
              </Badge>
            </div>
            {/* Energy filter selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Energía:</span>
              <Select value={energyFilter} onValueChange={setEnergyFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Filtrar energía" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baja Energía</SelectItem>
                  <SelectItem value="medium">Media Energía</SelectItem>
                  <SelectItem value="high">Alta Energía</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dopamine Primer Header Box - "No puedo arrancar" quick booster */}
          <Card className="border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 animate-bounce text-amber-500" />
                ¿Fricción de inicio? 🧠 Calienta tu mente primero
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Tu cerebro TDAH necesita dopamina antes de empezar una tarea aburrida. Haz un cebador de 3-5 minutos antes de tu sesión.
              </p>
            </div>
            <Button
              onClick={() => {
                if (primers.length > 0) {
                  const randomPrimer = primers[Math.floor(Math.random() * primers.length)];
                  handleStartPrimer(randomPrimer);
                } else {
                  handleStartPrimer({
                    id: "sys-default",
                    title: "Organiza 5 objetos en tu mesa",
                    type: "problem-solving",
                    duration: "3 min",
                    isSystem: true
                  });
                }
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 shrink-0 shadow-sm"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              No puedo arrancar → Probar Cebador
            </Button>
          </Card>

          {/* Procrastination Alerts */}
          {focusQueue.filter(t => t.status === "planning").length >= 3 && (
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-3.5 flex items-start gap-3 text-orange-800 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-orange-500" />
              <div className="text-xs">
                <span className="font-bold">Límite de Planificación:</span> Tienes 3 tareas en estado de planificación. Para evitar parálisis por análisis, no puedes crear nuevas tareas en este estado hasta que comiences o completes una.
              </div>
            </div>
          )}

          {/* Queue List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-card border border-border/50 h-28 rounded-xl" />
              ))}
            </div>
          ) : focusQueue.length === 0 ? (
            <Card className="card-mediterranean p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <Brain className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">¡Mente libre!</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No tienes deudas de atención pendientes para este nivel de energía. Disfruta tu paz o añade un nuevo reto.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {focusQueue.map((task) => {
                const metrics = task.tdahMetrics;
                const baseWeight = metrics?.emotionalWeight || 1;
                const streakDays = metrics?.streakDays || 0;
                const colors = getWeightColorStyles(baseWeight);
                const visual = getCardScaleAndStyle(baseWeight, streakDays);
                
                return (
                  <Card 
                    key={task.id}
                    className={visual.wrapperClass}
                  >
                    <div className="flex">
                      {/* Left Colored indicator bar */}
                      <div 
                        className="w-2 shrink-0"
                        style={{ backgroundColor: task.project?.color || colors.themeColor }}
                      />

                      <div className={cn("flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4", visual.sizeClass)}>
                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Badges / Meta */}
                          <div className="flex flex-wrap items-center gap-2">
                            {task.project && (
                              <Badge 
                                variant="outline" 
                                className="text-[10px] py-0 px-2 font-medium"
                                style={{ 
                                  borderColor: `${task.project.color}30`, 
                                  color: task.project.color,
                                  backgroundColor: `${task.project.color}08`
                                }}
                              >
                                {task.project.name}
                              </Badge>
                            )}

                            {streakDays > 3 && (
                              <Badge className="bg-red-600 text-white text-[9px] py-0.5 px-1.5 flex items-center gap-0.5 font-bold animate-pulse">
                                <Flame className="h-3 w-3" /> 🔥 Estancada (+{streakDays}d)
                              </Badge>
                            )}

                            {metrics?.isPromoted && (
                              <Badge className="bg-orange-500 text-white text-[9px] py-0.5 px-1.5 flex items-center gap-0.5 font-bold">
                                <AlertCircle className="h-3 w-3" /> Bloqueante
                              </Badge>
                            )}

                            {streakDays > 0 && streakDays <= 3 ? (
                              <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/5">
                                Intacta: {streakDays}d
                              </Badge>
                            ) : null}
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h3 className="font-bold text-foreground flex flex-wrap items-center gap-1.5 leading-tight break-words">
                              {streakDays > 3 && <span className="text-red-500 shrink-0">⚠️</span>}
                              <span className="break-words">{task.title}</span>
                            </h3>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed break-words">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Alarm notification for high streaks */}
                          {streakDays > 3 && (
                            <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                              ⚠️ Esta tarea te está robando energía mental. ¡Micro-divídela o alíviala ya!
                            </div>
                          )}

                          {/* Friction Notes "¿Qué me cuesta?" */}
                          {metrics?.blockReason && (
                            <div className="mt-2 text-xs bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/10 rounded p-2 text-amber-800 dark:text-amber-300 italic">
                              <strong>Fricción:</strong> &ldquo;{metrics.blockReason}&rdquo;
                            </div>
                          )}

                          {/* Focus Meta Pills */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5" /> {metrics?.timeBlock || "30min"}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              Energía: {metrics?.energyRequired === "low" ? "Baja" : metrics?.energyRequired === "high" ? "Alta" : "Media"}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="flex items-center gap-1">
                              Peso: <span className={cn("font-bold", colors.text)}>{baseWeight.toFixed(1)}/5.0</span>
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-col justify-end gap-2 shrink-0 pt-2 sm:pt-0 w-full sm:w-auto">
                          <Button
                            onClick={() => handleStartFocus(task)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 h-8 shadow-sm w-full"
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Iniciar Focus
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedTaskForSplit(task);
                              setIsMicroSplitOpen(true);
                            }}
                            className="border-border text-xs h-8 px-3 w-full"
                          >
                            <Split className="h-3.5 w-3.5 mr-1.5" />
                            Dividir Tarea
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Dopamine Primers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Cebador de Dopamina
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={fetchPrimers}
              title="Refrescar sugerencias"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Pequeños disparadores de energía mental de menos de 15 minutos para romper el bloqueo cognitivo antes de tu sesión.
          </p>

          {isPrimersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-card border border-border/50 h-24 rounded-xl" />
              ))}
            </div>
          ) : primers.length === 0 ? (
            <Card className="card-mediterranean p-6 text-center text-xs text-muted-foreground">
              Sin sugerencias activas. Haz clic en refrescar.
            </Card>
          ) : (
            <div className="space-y-3">
              {primers.map((primer) => (
                <Card 
                  key={primer.id}
                  className="border border-border/40 hover:border-border/80 transition-all bg-card shadow-sm hover:shadow-md"
                >
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge 
                          variant="secondary"
                          className={cn(
                            "text-[9px] py-0 px-1.5 font-bold uppercase",
                            primer.type === "social" 
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" 
                              : primer.type === "creative"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          )}
                        >
                          {primer.type === "social" ? "social" : primer.type === "creative" ? "creativo" : "solución"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{primer.duration}</span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground leading-tight truncate">
                        {primer.title}
                      </h4>
                      {primer.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {primer.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      onClick={() => handleStartPrimer(primer)}
                      className="w-7 h-7 rounded-full shrink-0 bg-amber-500 hover:bg-amber-400 text-white"
                      title="Activar cebador"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Micro Splitter */}
      <Dialog open={isMicroSplitOpen} onOpenChange={setIsMicroSplitOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Split className="h-5 w-5 text-[var(--mediterranean-terracotta)]" />
              Micro-División ADHD
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Divide la tarea pesada &quot;{selectedTaskForSplit?.title}&quot; en pequeños pasos secuenciales de 5-15 minutos. Facilita la acción al reducir la barrera cognitiva de inicio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            {splitSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 font-bold">{index + 1}.</span>
                <Input
                  value={step}
                  onChange={(e) => {
                    const newSteps = [...splitSteps];
                    newSteps[index] = e.target.value;
                    setSplitSteps(newSteps);
                  }}
                  placeholder={`Ej. Buscar el archivo excel, escribir la introducción...`}
                  className="text-sm bg-background border-border"
                />
                {splitSteps.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newSteps = splitSteps.filter((_, i) => i !== index);
                      setSplitSteps(newSteps);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              type="button"
              onClick={() => setSplitSteps([...splitSteps, ""])}
              className="text-xs border-border h-8 mt-2 w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Añadir Paso Intermedio
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setIsMicroSplitOpen(false);
                setSelectedTaskForSplit(null);
                setSplitSteps(["", ""]);
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMicroSplitSubmit}
              className="gradient-mediterranean text-white border-none shadow-sm hover:opacity-95 text-xs"
            >
              Crear Subtareas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Create Focus Task */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent className="max-w-lg bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-lg">
              <Brain className="h-5 w-5 text-[var(--mediterranean-terracotta)]" />
              Nueva Tarea de Enfoque (ADHD)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define una tarea adaptada a tu estado cognitivo. Configura su peso emocional y tiempo de enfoque preferido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 my-2">
            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="task-title" className="text-xs font-semibold text-foreground">Título de la Tarea</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Redactar borrador de la propuesta comercial"
                className="bg-background border-border text-sm"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="task-desc" className="text-xs font-semibold text-foreground">Notas / Enlaces Rápidos</Label>
              <Input
                id="task-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Añade detalles breves para evitar distracciones en el inicio"
                className="bg-background border-border text-sm"
              />
            </div>

            {/* Block Friction "¿Qué me cuesta?" */}
            <div className="space-y-1">
              <Label htmlFor="task-blockreason" className="text-xs font-semibold text-foreground">¿Qué te cuesta o bloquea de esta tarea? (Opcional)</Label>
              <Textarea
                id="task-blockreason"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="Ej. Siento pereza porque requiere ordenar datos repetitivos y no sé por dónde empezar"
                className="bg-background border-border text-sm h-16 resize-none"
              />
            </div>

            {/* Project & Dopamine Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="task-project" className="text-xs font-semibold text-foreground">Proyecto</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger id="task-project" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Seleccionar proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-dopamine" className="text-xs font-semibold text-foreground">Fuente de Recompensa</Label>
                <Select
                  value={newDopamineSource}
                  onValueChange={(val: any) => setNewDopamineSource(val)}
                >
                  <SelectTrigger id="task-dopamine" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Seleccionar fuente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Rutina (Hábito/Normal)</SelectItem>
                    <SelectItem value="creative">Creativo (Bocetos/Escrito)</SelectItem>
                    <SelectItem value="social">Social (Comunicar/Compartir)</SelectItem>
                    <SelectItem value="problem-solving">Ingenio (Puzzle/Reto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weight, Energy, Time Block */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="task-weight" className="text-xs font-semibold text-foreground">Carga Emocional</Label>
                <Select
                  value={newWeight.toString()}
                  onValueChange={(val) => setNewWeight(parseInt(val))}
                >
                  <SelectTrigger id="task-weight" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Peso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Muy Liviana)</SelectItem>
                    <SelectItem value="2">2 (Baja)</SelectItem>
                    <SelectItem value="3">3 (Normal)</SelectItem>
                    <SelectItem value="4">4 (Pesada)</SelectItem>
                    <SelectItem value="5">5 (Bloqueante)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-energy" className="text-xs font-semibold text-foreground">Energía Requerida</Label>
                <Select
                  value={newEnergy}
                  onValueChange={(val: any) => setNewEnergy(val)}
                >
                  <SelectTrigger id="task-energy" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Energía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja Energía</SelectItem>
                    <SelectItem value="medium">Media Energía</SelectItem>
                    <SelectItem value="high">Alta Energía</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-timeblock" className="text-xs font-semibold text-foreground">Bloque de Tiempo</Label>
                <Select value={newTimeBlock} onValueChange={setNewTimeBlock}>
                  <SelectTrigger id="task-timeblock" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Tiempo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">15 Minutos</SelectItem>
                    <SelectItem value="30min">30 Minutos</SelectItem>
                    <SelectItem value="45min">45 Minutos</SelectItem>
                    <SelectItem value="60min">60 Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Blocks Someone & State selection */}
            <div className="grid grid-cols-2 gap-4 pt-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="task-blocks"
                  checked={newBlocksSomeone}
                  onChange={(e) => setNewBlocksSomeone(e.target.checked)}
                  className="rounded border-border h-4 w-4 bg-background accent-[var(--mediterranean-terracotta)]"
                />
                <Label htmlFor="task-blocks" className="text-xs text-foreground cursor-pointer select-none">
                  Bloquea a otros del equipo
                </Label>
              </div>

              <div className="space-y-1">
                <Label htmlFor="task-status" className="text-xs font-semibold text-foreground">Estado de Enfoque</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="task-status" className="text-xs bg-background border-border">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">Para hacer (Cola Activa)</SelectItem>
                    <SelectItem value="planning">Planificación (En espera)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsCreateTaskOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingTask}
                className="gradient-mediterranean text-white border-none shadow-sm hover:opacity-95 text-xs"
              >
                {isSubmittingTask ? "Creando..." : "Guardar Tarea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
