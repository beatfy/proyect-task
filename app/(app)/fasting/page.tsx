"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Timer, Flame, Droplets, Zap, BookOpen, Bell, Play, Square,
  RotateCcw, CheckCircle2, MessageSquare, Sparkles, Clock, Activity,
  Info, ChevronRight, Award, Smile, Frown, Meh, TrendingUp, Calendar,
  ShieldAlert, Send, Bot, RefreshCw, Check, Trash2, Utensils, Coffee,
  Moon, Sun, Apple, HeartPulse, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetabolicPhase {
  phase: string;
  code: string;
  icon: string;
  shortDesc: string;
  detailDesc: string;
  tips: string;
}

interface EatingPhase {
  phase: string;
  code: string;
  icon: string;
  shortDesc: string;
  detailDesc: string;
  tips: string;
}

interface ActiveFastData {
  id: string;
  protocol: string;
  targetHours: number;
  startTime: string;
  elapsedHours: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  expectedEndTime: string;
  isGoalReached: boolean;
  extraHours?: number;
  extraMinutes?: number;
  currentPhase: MetabolicPhase;
}

interface EatingWindowData {
  lastFastId: string;
  startTime: string;
  targetEatingHours: number;
  elapsedHours: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  progressPercent: number;
  expectedEndTime: string;
  isWindowEnded: boolean;
  hoursSinceFast: number;
  currentPhase: EatingPhase;
  lastFast?: {
    id: string;
    protocol: string;
    targetHours: number;
    startTime: string;
    endTime: string;
    durationHours: number;
    completed: boolean;
    firstMeal?: string | null;
  };
}

interface FastingConfig {
  id: string;
  protocol: string;
  targetFastHours: number;
  targetEatingHours: number;
  waterGoalMl: number;
  waterDrankMl: number;
  notifyFastStart: boolean;
  notifyFastEnd: boolean;
  notifyWaterReminders: boolean;
  startTimePreference: string;
}

interface FastingStats {
  totalFasts: number;
  totalHours: number;
  currentStreak: number;
  avgHours: number;
}

interface FastingLog {
  id: string;
  protocol: string;
  targetHours: number;
  startTime: string;
  endTime: string | null;
  completed: boolean;
  durationHours: number;
  feeling?: string;
  notes?: string;
  firstMeal?: string | null;
  firstMealEvaluation?: string | null;
  energyLevel?: number | null;
  clarityLevel?: number | null;
  hungerLevel?: number | null;
}

const FASTING_PROTOCOLS = [
  {
    id: "16:8",
    name: "16:8 Leangains",
    tag: "Recomendado",
    tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    fastHours: 16,
    eatingHours: 8,
    difficulty: "Principiante - Intermedio",
    description: "Ayuna durante 16 horas y come en una ventana de 8 horas. Ideal para empezar y mantener un estilo de vida saludable sin esfuerzo extremo.",
    benefits: "Mejora la sensibilidad a la insulina, quema grasa durante la noche y mañana, activa la lipólisis.",
  },
  {
    id: "14:10",
    name: "14:10 Suave",
    tag: "Iniciación",
    tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    fastHours: 14,
    eatingHours: 10,
    difficulty: "Principiante",
    description: "Ayuno muy fácil de adaptar. Cenar temprano y desayunar algo más tarde para conseguir 14 horas de descanso digestivo.",
    benefits: "Estabiliza el azúcar en sangre y mejora el descanso nocturno.",
  },
  {
    id: "18:6",
    name: "18:6 Avanzado",
    tag: "Cetosis Alta",
    tagColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    fastHours: 18,
    eatingHours: 6,
    difficulty: "Intermedio",
    description: "18 horas de ayuno con una ventana de 6 horas para 2 comidas nutritivas. Aumenta la producción de cetonas.",
    benefits: "Cetosis sostenida, mayor claridad mental y pico elevado de la Hormona del Crecimiento (HGH).",
  },
  {
    id: "20:4",
    name: "20:4 La Dieta del Guerrero",
    tag: "Intenso",
    tagColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    fastHours: 20,
    eatingHours: 4,
    difficulty: "Avanzado",
    description: "Ayuno de 20 horas con una pequeña ventana nocturna de 4 horas. Para usuarios experimentados.",
    benefits: "Estimula intensamente la autofagia celular y la flexibilidad metabólica profunda.",
  },
  {
    id: "24:0",
    name: "24h OMAD (1 comida al día)",
    tag: "Experto",
    tagColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    fastHours: 24,
    eatingHours: 1,
    difficulty: "Experto",
    description: "Un ayuno completo de cena a cena o de almuerzo a almuerzo (24 horas).",
    benefits: "Máxima autofagia, reciclaje celular profundo y reseteo inmunitario.",
  },
];

const METABOLIC_TIMELINE = [
  { hours: "0 - 4h", title: "Digestión y Glucosa", desc: "El cuerpo procesa la última comida. Los niveles de insulina están elevados.", icon: "🥗", color: "from-blue-500 to-indigo-500" },
  { hours: "4 - 8h", title: "Caída de Insulina", desc: "La glucosa disminuye. El cuerpo empieza a vaciar las reservas de glucógeno.", icon: "📉", color: "from-indigo-500 to-cyan-500" },
  { hours: "8 - 12h", title: "Cetosis Inicial", desc: "Se agota el glucógeno hepático. Comienza la lipólisis activa (quema de grasa).", icon: "🔥", color: "from-amber-500 to-orange-500" },
  { hours: "12 - 16h", title: "Cetosis Profunda & HGH", desc: "Pico de cuerpos cetónicos y Hormona del Crecimiento. Foco y claridad mental.", icon: "⚡", color: "from-orange-500 to-rose-500" },
  { hours: "16 - 24h+", title: "Autofagia Celular", desc: "Reciclaje de células dañadas, regeneración de tejidos y reducción de inflamación.", icon: "🧬", color: "from-rose-500 to-purple-600" },
];

const EATING_TIMELINE = [
  { hours: "0 - 1.5h", title: "Apertura & Fast Breaker", desc: "Reactivación enzimática suave. Alta sensibilidad insulínica. Grasas saludables y proteínas limpias.", icon: "🥣", color: "from-amber-500 to-emerald-500" },
  { hours: "1.5 - 6h", title: "Nutrición & Absorción", desc: "Comidas principales completas, recarga de depósitos de glucógeno y síntesis proteica.", icon: "🍽️", color: "from-emerald-500 to-teal-500" },
  { hours: "6 - 8h", title: "Última Comida & Cierre", desc: "Comida saciante rica en fibra/proteína. Dejar 2-3h antes de dormir para preparar el nuevo ayuno.", icon: "🥑", color: "from-teal-500 to-indigo-500" },
  { hours: "> 8h+", title: "Ventana Finalizada", desc: "Límite de ventana completado. Momento idóneo para iniciar el nuevo ciclo de ayuno.", icon: "⏳", color: "from-indigo-500 to-purple-500" },
];

export default function FastingPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<FastingConfig | null>(null);
  const [activeFast, setActiveFast] = useState<ActiveFastData | null>(null);
  const [eatingWindow, setEatingWindow] = useState<EatingWindowData | null>(null);
  const [fastingMode, setFastingMode] = useState<"FASTING" | "EATING_WINDOW" | "IDLE">("IDLE");
  const [stats, setStats] = useState<FastingStats | null>(null);
  const [history, setHistory] = useState<FastingLog[]>([]);
  const [timelineTab, setTimelineTab] = useState<"fasting" | "eating">("fasting");

  // Chat con Doc
  const [docMessages, setDocMessages] = useState<Array<{ role: string; content: string }>>([
    {
      role: "assistant",
      content: "¡Hola! Soy **Doc**, tu médico y experto en Ayuno Intermitente. Estoy conectado a tu registro en tiempo real. ¿Tienes preguntas sobre qué beber, qué comer al romper el ayuno o cómo va tu racha?",
    },
  ]);
  const [docInput, setDocInput] = useState("");
  const [sendingDoc, setSendingDoc] = useState(false);

  // Estados de formularios / modales
  const [customFastHours, setCustomFastHours] = useState("16");
  const [startTimeOverride, setStartTimeOverride] = useState("");
  const [feelingModal, setFeelingModal] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState("great");
  const [fastNotes, setFastNotes] = useState("");
  const [firstMeal, setFirstMeal] = useState("");
  const [energyLevel, setEnergyLevel] = useState(4);
  const [clarityLevel, setClarityLevel] = useState(5);
  const [hungerLevel, setHungerLevel] = useState(2);

  const fetchFastingStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/fasting/status");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setActiveFast(data.activeFast);
        setEatingWindow(data.eatingWindow);
        setFastingMode(data.mode || (data.activeFast ? "FASTING" : data.eatingWindow ? "EATING_WINDOW" : "IDLE"));
        setStats(data.stats);

        if (data.mode === "EATING_WINDOW") {
          setTimelineTab("eating");
        } else if (data.mode === "FASTING") {
          setTimelineTab("fasting");
        }
      }
    } catch (err) {
      console.error("Error fetching fasting status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/fasting/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  }, []);

  useEffect(() => {
    fetchFastingStatus();
    fetchHistory();
  }, [fetchFastingStatus, fetchHistory]);

  // Actualización periódica cada 30s del temporizador
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFastingStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFastingStatus]);

  const handleStartFast = async (protocolId?: string, targetH?: number) => {
    try {
      const protocol = protocolId || config?.protocol || "16:8";
      const targetHours = targetH || (protocolId === "custom" ? parseInt(customFastHours) || 16 : config?.targetFastHours || 16);

      let payload: { protocol: string; targetHours: number; startTime?: string } = {
        protocol,
        targetHours,
      };

      if (startTimeOverride) {
        payload.startTime = new Date(startTimeOverride).toISOString();
      }

      const res = await fetch("/api/v1/fasting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("🚀 ¡Ayuno iniciado! Tu cuerpo ha comenzado el proceso.");
        setStartTimeOverride("");
        fetchFastingStatus();
        fetchHistory();
      } else {
        toast.error("Error al iniciar el ayuno");
      }
    } catch (err) {
      console.error("Start fast error:", err);
      toast.error("Error de conexión");
    }
  };

  const handleEndFast = async () => {
    try {
      const res = await fetch("/api/v1/fasting/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeling: selectedFeeling,
          notes: fastNotes,
          firstMeal,
          energyLevel,
          clarityLevel,
          hungerLevel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.completedGoal) {
          toast.success("🎉 ¡Felicidades! Has completado tu objetivo de ayuno.");
        } else {
          toast.info("Ayuno finalizado. ¡Cualquier hora de ayuno beneficia a tu metabolismo!");
        }
        setFeelingModal(false);
        setFastNotes("");
        setFirstMeal("");
        setActiveFast(null);
        fetchFastingStatus();
        fetchHistory();
      } else {
        toast.error("Error al finalizar el ayuno");
      }
    } catch (err) {
      console.error("End fast error:", err);
      toast.error("Error de conexión");
    }
  };

  const handleDiscardFast = async () => {
    if (!confirm("¿Deseas cancelar el ayuno actual y reiniciar el contador a cero?")) {
      return;
    }
    try {
      const res = await fetch("/api/v1/fasting/status", {
        method: "DELETE",
      });
      if (res.ok) {
        setActiveFast(null);
        toast.success("Ayuno cancelado. Contador reiniciado a cero.");
        fetchFastingStatus();
        fetchHistory();
      } else {
        toast.error("Error al cancelar el ayuno");
      }
    } catch (err) {
      console.error("Discard fast error:", err);
      toast.error("Error de conexión");
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!confirm("¿Deseas eliminar este registro de ayuno?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/fasting/history?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Registro eliminado del historial");
        fetchFastingStatus();
        fetchHistory();
      } else {
        toast.error("Error al eliminar");
      }
    } catch (err) {
      console.error("Delete history error:", err);
      toast.error("Error de conexión");
    }
  };

  const handleAddWater = async (amountMl: number) => {
    try {
      const res = await fetch("/api/v1/fasting/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig((prev) => (prev ? { ...prev, waterDrankMl: data.waterDrankMl } : null));
        toast.success(`💧 +${amountMl}ml registrados. Total hoy: ${data.waterDrankMl}ml`);
      }
    } catch (err) {
      console.error("Water error:", err);
    }
  };

  const handleSaveConfig = async (updatedFields: Partial<FastingConfig>) => {
    try {
      const res = await fetch("/api/v1/fasting/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        toast.success("Preferencias guardadas");
        fetchFastingStatus();
      }
    } catch (err) {
      console.error("Config save error:", err);
    }
  };

  const handleSendDocMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!docInput.trim() || sendingDoc) return;

    const userText = docInput.trim();
    setDocInput("");
    setDocMessages((prev) => [...prev, { role: "user", content: userText }]);
    setSendingDoc(true);

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "doc",
          message: `[CONSULTA SOBRE AYUNO INTERMITENTE]\n${userText}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDocMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      } else {
        setDocMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, tuve un problema al conectar con el servidor. Intenta de nuevo en unos momentos." },
        ]);
      }
    } catch (err) {
      console.error("Doc chat error:", err);
    } finally {
      setSendingDoc(false);
    }
  };

  const formatHoursMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
        <p className="text-sm text-muted-foreground">Cargando tu centro de ayuno intermitente...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8">
      {/* Header banner con gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 p-6 md:p-10 border border-emerald-500/20 shadow-2xl text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Salud & Longevidad Metabólica
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Ayuno Intermitente <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">&</span> Doc IA
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm md:text-base">
              Controla tu ayuno en tiempo real, descubre tus fases metabólicas, mantén la motivación y consulta directamente con Doc, tu médico especialista con súper acceso.
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <div className="text-xs text-slate-400">Racha Actual</div>
              <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                {stats?.currentStreak || 0} <span className="text-xs text-slate-300">días</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <div className="text-xs text-slate-400">Ayunos Hechos</div>
              <div className="text-2xl font-bold text-cyan-300 flex items-center justify-center gap-1">
                <Award className="w-5 h-5 text-cyan-300" />
                {stats?.totalFasts || 0}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
              <div className="text-xs text-slate-400">Horas Totales</div>
              <div className="text-2xl font-bold text-amber-300 flex items-center justify-center gap-1">
                <Clock className="w-5 h-5 text-amber-300" />
                {stats?.totalHours || 0}h
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="timer" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1.5 bg-muted/60 backdrop-blur rounded-2xl border">
          <TabsTrigger value="timer" className="rounded-xl py-2.5 flex items-center gap-2 font-medium">
            <Timer className="w-4 h-4 text-emerald-500" />
            <span>Cronómetro</span>
          </TabsTrigger>
          <TabsTrigger value="protocols" className="rounded-xl py-2.5 flex items-center gap-2 font-medium">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Protocolos</span>
          </TabsTrigger>
          <TabsTrigger value="guide" className="rounded-xl py-2.5 flex items-center gap-2 font-medium">
            <BookOpen className="w-4 h-4 text-cyan-500" />
            <span>Guía & Consejos</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl py-2.5 flex items-center gap-2 font-medium">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span>Historial</span>
          </TabsTrigger>
          <TabsTrigger value="doc" className="rounded-xl py-2.5 flex items-center gap-2 font-medium col-span-2 md:col-span-1">
            <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Hablar con Doc</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TIMER & ACTIVE FAST / EATING WINDOW */}
        <TabsContent value="timer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna Principal: Reloj y Control */}
            <Card className={cn(
              "lg:col-span-2 shadow-xl overflow-hidden relative border-2",
              fastingMode === "FASTING" ? "border-emerald-500/20" : fastingMode === "EATING_WINDOW" ? "border-amber-500/30 bg-card" : "border-muted"
            )}>
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1.5",
                fastingMode === "FASTING"
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                  : fastingMode === "EATING_WINDOW"
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500"
                  : "bg-muted"
              )}></div>

              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      {fastingMode === "FASTING" ? (
                        <>
                          <Clock className="w-5 h-5 text-emerald-500" />
                          <span>Estado: Ayuno Intermitente Activo</span>
                        </>
                      ) : fastingMode === "EATING_WINDOW" ? (
                        <>
                          <Utensils className="w-5 h-5 text-amber-500" />
                          <span>Estado: Ventana de Alimentación</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <span>Estado Actual de Ayuno</span>
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {fastingMode === "FASTING" && activeFast
                        ? `Protocolo ${activeFast.protocol} — Meta: ${activeFast.targetHours} horas de descanso digestivo.`
                        : fastingMode === "EATING_WINDOW" && eatingWindow
                        ? `Ventana de ${eatingWindow.targetEatingHours} horas para nutrirte e hidratarte de forma consciente.`
                        : "No tienes un ciclo en curso actualmente. ¡Inicia uno para comenzar!"}
                    </CardDescription>
                  </div>

                  <div>
                    {fastingMode === "FASTING" && activeFast && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-3 py-1 font-semibold text-xs",
                          activeFast.isGoalReached
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 animate-pulse"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {activeFast.isGoalReached
                          ? `🎉 ¡Objetivo Cumplido! (+${activeFast.extraHours || 0}h)`
                          : `En Ayuno (${activeFast.protocol})`}
                      </Badge>
                    )}

                    {fastingMode === "EATING_WINDOW" && eatingWindow && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-3 py-1 font-semibold text-xs",
                          eatingWindow.isWindowEnded
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {eatingWindow.isWindowEnded
                          ? "⏰ Ventana Finalizada — Hora de Ayunar"
                          : `🍽️ Ventana Abierta (${eatingWindow.targetEatingHours}h)`}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* 1. MODO AYUNO ACTIVO */}
                {fastingMode === "FASTING" && activeFast && (
                  <div className="flex flex-col items-center justify-center space-y-6 py-4">
                    {/* Alerta Destacada si ya alcanzó o superó el objetivo de ayuno */}
                    {activeFast.isGoalReached && (
                      <div className="w-full max-w-lg p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border-2 border-emerald-500/40 shadow-lg flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-center gap-2 font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="w-5 h-5 text-emerald-500 animate-bounce" />
                          <span>🎯 ¡Meta de {activeFast.targetHours}h Completada! Ya puedes comer</span>
                        </div>
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                          Has alcanzado tu objetivo de ayuno. Tu ventana de alimentación ({config?.targetEatingHours || 8}h) está lista para abrirse. Puedes romper tu ayuno ahora para pasar a la fase de comida o seguir en modo ayuno extendido.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 w-full pt-1">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs py-5 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                            onClick={() => setFeelingModal(true)}
                          >
                            <Utensils className="w-4 h-4" />
                            <span>🍽️ Romper Ayuno & Abrir Ventana para Comer</span>
                          </Button>
                          <Badge variant="outline" className="px-3 py-2 text-xs font-semibold justify-center border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            +{activeFast.extraHours || 0}h en autofagia
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Ring Visual del Temporizador de Ayuno */}
                    <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Track ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="currentColor"
                          strokeWidth="7"
                          className="text-muted/30"
                          fill="transparent"
                        />
                        {/* Progress ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="url(#gradientFast)"
                          strokeWidth="7"
                          strokeDasharray={263.89}
                          strokeDashoffset={263.89 - (263.89 * Math.min(100, activeFast.progressPercent || 0)) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                          fill="transparent"
                        />
                        <defs>
                          <linearGradient id="gradientFast" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#14b8a6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                      </svg>

                      {/* Info central del reloj */}
                      <div className="absolute flex flex-col items-center text-center p-4">
                        <span className="text-4xl md:text-5xl font-black tracking-tight text-foreground font-mono">
                          {formatHoursMinutes(activeFast.elapsedMinutes)}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
                          de {activeFast.targetHours}h objetivo
                        </span>
                        <div className={cn(
                          "mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full",
                          activeFast.isGoalReached
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {activeFast.isGoalReached ? "🎉 ¡100% Meta Completada!" : `${activeFast.progressPercent}% completado`}
                        </div>
                      </div>
                    </div>

                    {/* Meta y Fin Estimado */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg bg-muted/40 p-4 rounded-2xl border text-center text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Inicio Ayuno</div>
                        <div className="font-semibold text-foreground">
                          {new Date(activeFast.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Apertura Ventana</div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Date(activeFast.expectedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-muted-foreground text-xs">
                          {activeFast.isGoalReached ? "Tiempo Extra" : "Falta para Comer"}
                        </div>
                        <div className={cn(
                          "font-semibold",
                          activeFast.isGoalReached ? "text-amber-500" : "text-foreground"
                        )}>
                          {activeFast.isGoalReached
                            ? `+${formatHoursMinutes(activeFast.extraMinutes || 0)}`
                            : formatHoursMinutes(activeFast.remainingMinutes)}
                        </div>
                      </div>
                    </div>

                    {/* Deep Work / Focus Peak Banner */}
                    {activeFast.elapsedHours >= 12 && (
                      <div className="w-full max-w-lg p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 border border-amber-500/30 flex flex-col gap-3">
                        <div className="flex items-center gap-2 font-bold text-sm text-amber-600 dark:text-amber-400">
                          <Zap className="w-4 h-4 text-amber-500 fill-current" />
                          <span>Pico de Claridad Mental & Enfoque (Deep Work)</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Tu cerebro está operando con cetonas y tienes máxima lucidez cognitiva. Es el momento perfecto para resolver tareas complejas.
                        </p>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                          onClick={() => window.location.href = "/tasks"}
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>Abrir Tablero de Tareas & Enfoque</span>
                        </Button>
                      </div>
                    )}

                    {/* Botones de Acción */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg">
                      <Button
                        size="lg"
                        className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20"
                        onClick={() => setFeelingModal(true)}
                      >
                        <Utensils className="w-4 h-4 mr-2" />
                        Finalizar Ayuno / Empezar a Comer
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10 rounded-xl"
                        onClick={handleDiscardFast}
                        title="Cancelar ayuno actual y reiniciar el contador a cero"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reiniciar a 0
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. MODO VENTANA DE ALIMENTACIÓN (EATING WINDOW) */}
                {fastingMode === "EATING_WINDOW" && eatingWindow && (
                  <div className="flex flex-col items-center justify-center space-y-6 py-4">
                    {/* Banner de Ventana de Ingesta */}
                    <div className={cn(
                      "w-full max-w-lg p-5 rounded-3xl border-2 shadow-lg flex flex-col items-center text-center gap-3",
                      eatingWindow.isWindowEnded
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200"
                        : "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border-amber-500/30"
                    )}>
                      <div className="flex items-center justify-center gap-2 font-extrabold text-base text-amber-600 dark:text-amber-400">
                        <Utensils className="w-5 h-5 text-amber-500" />
                        <span>
                          {eatingWindow.isWindowEnded
                            ? "⏰ Ventana de Alimentación Cumplida"
                            : "🍽️ ¡Estás en tu Ventana de Alimentación!"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                        {eatingWindow.isWindowEnded
                          ? `Han pasado las ${eatingWindow.targetEatingHours} horas de tu ventana de comida. Es recomendable cerrar tu última ingesta e iniciar tu siguiente ayuno para descansar tu sistema digestivo.`
                          : `Aprovecha esta ventana de ${eatingWindow.targetEatingHours}h para realizar comidas ricas en proteínas, grasas saludables y nutrientes de calidad sin prisas.`}
                      </p>

                      {eatingWindow.lastFast?.firstMeal && (
                        <div className="w-full bg-card/60 p-2.5 rounded-xl border text-xs text-left">
                          <span className="font-semibold text-foreground">🥗 Rompiste ayuno con: </span>
                          <span className="text-muted-foreground">{eatingWindow.lastFast.firstMeal}</span>
                        </div>
                      )}
                    </div>

                    {/* Ring Visual de la Ventana de Alimentación */}
                    <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Track ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="currentColor"
                          strokeWidth="7"
                          className="text-muted/30"
                          fill="transparent"
                        />
                        {/* Progress ring */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="url(#gradientEating)"
                          strokeWidth="7"
                          strokeDasharray={263.89}
                          strokeDashoffset={263.89 - (263.89 * Math.min(100, eatingWindow.progressPercent || 0)) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                          fill="transparent"
                        />
                        <defs>
                          <linearGradient id="gradientEating" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="50%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                      </svg>

                      {/* Info central del reloj de comida */}
                      <div className="absolute flex flex-col items-center text-center p-4">
                        <span className="text-4xl md:text-5xl font-black tracking-tight text-foreground font-mono">
                          {formatHoursMinutes(eatingWindow.elapsedMinutes)}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
                          de {eatingWindow.targetEatingHours}h ventana
                        </span>
                        <div className={cn(
                          "mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full",
                          eatingWindow.isWindowEnded
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {eatingWindow.isWindowEnded
                            ? "Tiempo de Iniciar Siguiente Ayuno"
                            : `Quedan ${formatHoursMinutes(eatingWindow.remainingMinutes)}`}
                        </div>
                      </div>
                    </div>

                    {/* Métricas de la Ventana */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg bg-muted/40 p-4 rounded-2xl border text-center text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Apertura Ventana</div>
                        <div className="font-semibold text-foreground">
                          {new Date(eatingWindow.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Cierre Recomendado</div>
                        <div className="font-semibold text-amber-600 dark:text-amber-400">
                          {new Date(eatingWindow.expectedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-muted-foreground text-xs">Estado</div>
                        <div className="font-semibold text-foreground">
                          {eatingWindow.isWindowEnded ? "Expirada" : "Activa"}
                        </div>
                      </div>
                    </div>

                    {/* Formulario y Botón para Iniciar el Siguiente Ayuno */}
                    <div className="w-full max-w-lg p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 flex flex-col gap-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                          <Timer className="w-4 h-4 text-emerald-500" />
                          <span>Iniciar Siguiente Ciclo de Ayuno</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          Plan {config?.protocol || "16:8"} ({config?.targetFastHours || 16}h)
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        ¿Has terminado tu última comida del día? Inicia tu nuevo ayuno ahora para continuar tu ciclo continuo de 24 horas y mantener tu racha.
                      </p>

                      <div className="space-y-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">¿Terminaste de comer hace un rato? (Opcional)</Label>
                          <Input
                            type="datetime-local"
                            value={startTimeOverride}
                            onChange={(e) => setStartTimeOverride(e.target.value)}
                            className="rounded-xl text-xs h-9"
                          />
                        </div>

                        <Button
                          size="lg"
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2"
                          onClick={() => handleStartFast()}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Iniciar Siguiente Ayuno Ahora
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. MODO IDLE (SIN AYUNO NI VENTANA PREVIA) */}
                {fastingMode === "IDLE" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                      <Timer className="w-10 h-10 animate-bounce" />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <h3 className="text-xl font-bold text-foreground">¿Listo para iniciar tu ciclo de ayuno?</h3>
                      <p className="text-sm text-muted-foreground">
                        Selecciona tu plan preferido ({config?.protocol || "16:8"}) o ajusta la hora de inicio si comenzaste después de tu última comida.
                      </p>
                    </div>

                    {/* Ajuste de hora si inició antes */}
                    <div className="w-full max-w-sm space-y-3 bg-muted/40 p-4 rounded-2xl border">
                      <Label className="text-xs font-semibold text-muted-foreground">¿Empezaste antes? (Opcional)</Label>
                      <Input
                        type="datetime-local"
                        value={startTimeOverride}
                        onChange={(e) => setStartTimeOverride(e.target.value)}
                        className="rounded-xl text-sm"
                      />
                    </div>

                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-8 py-6 rounded-2xl shadow-xl shadow-emerald-500/20 text-base"
                      onClick={() => handleStartFast()}
                    >
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      Iniciar Ayuno {config?.protocol || "16:8"} Ahora
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Columna Derecha: Fase Actual (Metabólica o Nutricional) e Hidratación */}
            <div className="space-y-6">
              {/* Card de Fase Actual (Dinámica según Ayuno o Ventana de Comida) */}
              <Card className={cn(
                "shadow-lg border-2",
                fastingMode === "FASTING" ? "border-cyan-500/20" : fastingMode === "EATING_WINDOW" ? "border-amber-500/30" : "border-muted"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    {fastingMode === "FASTING" ? (
                      <>
                        <Activity className="w-4 h-4 text-cyan-500" />
                        <span>Fase Metabólica Actual (Ayuno)</span>
                      </>
                    ) : fastingMode === "EATING_WINDOW" ? (
                      <>
                        <Utensils className="w-4 h-4 text-amber-500" />
                        <span>Fase de la Ventana de Comida</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span>Fase Actual</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fastingMode === "FASTING" && activeFast ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-cyan-700 dark:text-cyan-300">
                          <span className="text-2xl">{activeFast.currentPhase.icon}</span>
                          <span>{activeFast.currentPhase.phase}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {activeFast.currentPhase.detailDesc}
                        </p>
                      </div>

                      <div className="bg-muted/40 p-3 rounded-xl border text-xs space-y-1">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">💡 Consejo de Doc:</span>
                        <p className="text-muted-foreground">{activeFast.currentPhase.tips}</p>
                      </div>
                    </div>
                  ) : fastingMode === "EATING_WINDOW" && eatingWindow ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                          <span className="text-2xl">{eatingWindow.currentPhase.icon}</span>
                          <span>{eatingWindow.currentPhase.phase}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {eatingWindow.currentPhase.detailDesc}
                        </p>
                      </div>

                      <div className="bg-muted/40 p-3 rounded-xl border text-xs space-y-1">
                        <span className="font-semibold text-amber-600 dark:text-amber-400 block">💡 Consejo Nutricional de Doc:</span>
                        <p className="text-muted-foreground">{eatingWindow.currentPhase.tips}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground space-y-2">
                      <Info className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p>Inicia un ayuno para seguir el progreso biológico de tus células en tiempo real.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card de Registro de Agua */}
              <Card className="border-blue-500/20 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      Hidratación Diaria
                    </CardTitle>
                    <span className="text-xs font-semibold text-blue-500">
                      {config?.waterDrankMl || 0} / {config?.waterGoalMl || 2500} ml
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress bar de agua */}
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round(((config?.waterDrankMl || 0) / (config?.waterGoalMl || 2500)) * 100))}%`,
                      }}
                    ></div>
                  </div>

                  {/* Botones rápidos de agua */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-medium border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => handleAddWater(250)}
                    >
                      +250 ml (Vaso)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-medium border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => handleAddWater(500)}
                    >
                      +500 ml (Botella)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-medium border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => handleAddWater(750)}
                    >
                      +750 ml
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Timeline Completo: Selector entre Fases Metabólicas (Ayuno) y Fases de Ventana de Alimentación (Comida) */}
          <Card className="border-muted shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Línea de Tiempo del Ciclo Completo
                  </CardTitle>
                  <CardDescription>
                    Conoce en detalle lo que sucede en tu organismo tanto en la fase de ayuno como en la ventana de alimentación.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border w-fit">
                  <Button
                    size="sm"
                    variant={timelineTab === "fasting" ? "default" : "ghost"}
                    className={cn("rounded-lg text-xs font-semibold h-8", timelineTab === "fasting" && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                    onClick={() => setTimelineTab("fasting")}
                  >
                    <Flame className="w-3.5 h-3.5 mr-1" />
                    Fases Metabólicas (Ayuno)
                  </Button>
                  <Button
                    size="sm"
                    variant={timelineTab === "eating" ? "default" : "ghost"}
                    className={cn("rounded-lg text-xs font-semibold h-8", timelineTab === "eating" && "bg-amber-600 hover:bg-amber-700 text-white")}
                    onClick={() => setTimelineTab("eating")}
                  >
                    <Utensils className="w-3.5 h-3.5 mr-1" />
                    Ventana para Comer ({config?.targetEatingHours || 8}h)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {timelineTab === "fasting" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {METABOLIC_TIMELINE.map((item, idx) => {
                    const isCurrentPhase = activeFast && (
                      (idx === 0 && activeFast.elapsedHours < 4) ||
                      (idx === 1 && activeFast.elapsedHours >= 4 && activeFast.elapsedHours < 8) ||
                      (idx === 2 && activeFast.elapsedHours >= 8 && activeFast.elapsedHours < 12) ||
                      (idx === 3 && activeFast.elapsedHours >= 12 && activeFast.elapsedHours < 16) ||
                      (idx === 4 && activeFast.elapsedHours >= 16)
                    );
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-200 hover:shadow-md space-y-2 relative overflow-hidden",
                          isCurrentPhase
                            ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/10"
                            : "bg-card/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{item.icon}</span>
                          <Badge
                            variant={isCurrentPhase ? "default" : "secondary"}
                            className={cn("text-[10px] font-bold", isCurrentPhase && "bg-emerald-600 text-white")}
                          >
                            {item.hours}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {EATING_TIMELINE.map((item, idx) => {
                    const isCurrentEatingPhase = eatingWindow && (
                      (idx === 0 && eatingWindow.elapsedHours < 1.5) ||
                      (idx === 1 && eatingWindow.elapsedHours >= 1.5 && eatingWindow.elapsedHours < Math.max(1.5, eatingWindow.targetEatingHours - 2)) ||
                      (idx === 2 && eatingWindow.elapsedHours >= Math.max(1.5, eatingWindow.targetEatingHours - 2) && eatingWindow.elapsedHours <= eatingWindow.targetEatingHours) ||
                      (idx === 3 && eatingWindow.elapsedHours > eatingWindow.targetEatingHours)
                    );
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-200 hover:shadow-md space-y-2 relative overflow-hidden",
                          isCurrentEatingPhase
                            ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10"
                            : "bg-card/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{item.icon}</span>
                          <Badge
                            variant={isCurrentEatingPhase ? "default" : "secondary"}
                            className={cn("text-[10px] font-bold", isCurrentEatingPhase && "bg-amber-600 text-white")}
                          >
                            {item.hours}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SELECTOR DE PROTOCOLOS */}
        <TabsContent value="protocols" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Selecciona tu Plan de Ayuno</h2>
            <p className="text-sm text-muted-foreground">
              Elige el protocolo que mejor se adapte a tu rutina y objetivos metabólicos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FASTING_PROTOCOLS.map((protocol) => {
              const isCurrent = config?.protocol === protocol.id;
              return (
                <Card
                  key={protocol.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col justify-between border-2",
                    isCurrent ? "border-emerald-500 ring-4 ring-emerald-500/10 bg-emerald-500/5" : "border-muted"
                  )}
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={protocol.tagColor}>
                        {protocol.tag}
                      </Badge>
                      <span className="text-xs font-semibold text-muted-foreground">{protocol.difficulty}</span>
                    </div>
                    <CardTitle className="text-xl font-bold">{protocol.name}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {protocol.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/40 p-3 rounded-xl text-xs space-y-1">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Beneficios clave:</span>
                      <p className="text-muted-foreground">{protocol.benefits}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t font-semibold">
                      <span>⏱️ Ayuno: {protocol.fastHours}h</span>
                      <span>🍽️ Ventana: {protocol.eatingHours}h</span>
                    </div>

                    <Button
                      className={cn(
                        "w-full rounded-xl font-bold",
                        isCurrent
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                      onClick={() => {
                        handleSaveConfig({
                          protocol: protocol.id,
                          targetFastHours: protocol.fastHours,
                          targetEatingHours: protocol.eatingHours,
                        });
                        toast.success(`Protocolo ${protocol.name} establecido como tu plan principal.`);
                      }}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="w-4 h-4 mr-2" /> Plan Actual Seleccionado
                        </>
                      ) : (
                        `Seleccionar Protocolo ${protocol.id}`
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {/* Tarjeta Personalizada */}
            <Card className="border-dashed border-2 flex flex-col justify-between p-6 bg-muted/20">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Personalizado
                </Badge>
                <h3 className="text-xl font-bold">Ayuno a Medida</h3>
                <p className="text-xs text-muted-foreground">
                  Define el número exacto de horas de ayuno que deseas realizar hoy.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Horas de Ayuno Objetivo</Label>
                  <Input
                    type="number"
                    min="8"
                    max="48"
                    value={customFastHours}
                    onChange={(e) => setCustomFastHours(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <Button
                className="w-full mt-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => handleStartFast("custom", parseInt(customFastHours) || 16)}
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Iniciar Ayuno Personalizado ({customFastHours}h)
              </Button>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: GUÍA Y CONSEJOS */}
        <TabsContent value="guide" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bebidas Permitidas */}
            <Card className="border-emerald-500/20 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Bebidas Permitidas (Sin Romper el Ayuno)
                </CardTitle>
                <CardDescription>
                  Estas bebidas no activan la digestión ni provocan picos de insulina.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 font-medium">
                  💧 <strong>Agua Mineral:</strong> Con o sin gas. Es esencial beber suficiente durante el día.
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 font-medium">
                  ☕ <strong>Café Solo Negro:</strong> Sin leche, nata ni azúcares. Acelera ligeramente el metabolismo.
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 font-medium">
                  🍵 <strong>Té e Infusiones:</strong> Té verde, té negro, manzanilla o menta sin endulzar.
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 font-medium">
                  🧂 <strong>Agua con Sal Marina o Electrólitos:</strong> Evita dolores de cabeza y calambres durante ayunos prolongados.
                </div>
              </CardContent>
            </Card>

            {/* Qué Rompe el Ayuno */}
            <Card className="border-rose-500/20 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  Alimentos y Errores que Rompen el Ayuno
                </CardTitle>
                <CardDescription>
                  Cualquier aporte calórico relevante detiene los procesos de autofagia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 font-medium">
                  🥛 <strong>Leche o Bebidas Vegetales:</strong> Añadir leche al café contiene lactosa o azúcares que rompen el ayuno.
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 font-medium">
                  🥤 <strong>Refrescos / Zumos:</strong> Incluso zumos naturales contienen fructosa e insulina.
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 font-medium">
                  🍬 <strong>Edulcorantes Artificiales en Exceso:</strong> Algunos edulcorantes pueden estimular la respuesta cefálica de insulina.
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 font-medium">
                  🍬 <strong>Caramelos o Chicles con Azúcar:</strong> Activan el tracto digestivo y rompen el estado metabólico.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cómo romper el ayuno de forma saludable */}
          <Card className="border-amber-500/20 bg-amber-500/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-amber-600 dark:text-amber-400">
                🥗 Consejos de Doc para Romper el Ayuno Correctamente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>
                1. <strong>Comienza con algo suave:</strong> Un vaso de agua, un puñado de frutos secos o un caldo de huesos prepara tu estómago.
              </p>
              <p>
                2. <strong>Prioriza proteínas magras y grasas saludables:</strong> Huevos, pollo, pescado, aguacate y verduras de hoja verde.
              </p>
              <p>
                3. <strong>Evita atrancarte con carbohidratos simples:</strong> Evita pizzas, bollería o azúcares inmediatamente al abrir la ventana para no sufrir picos bruscos de glucosa ni somnolencia postprandial.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: HISTORIAL Y ESTADÍSTICAS */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-muted shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                Historial de Ayunos Completados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/40 rounded-2xl border gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                          item.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {item.completed ? "✓" : "⏱️"}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">
                            Ayuno {item.protocol} ({item.durationHours}h alcanzadas)
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Iniciado: {new Date(item.startTime).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={item.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-muted"}>
                            {item.completed ? "Objetivo Cumplido" : "Parcial / Interrumpido"}
                          </Badge>
                          {item.energyLevel && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                              ⚡ {item.energyLevel}/5 energía
                            </span>
                          )}
                          {item.clarityLevel && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                              🧠 {item.clarityLevel}/5 foco
                            </span>
                          )}
                        </div>

                        {item.firstMeal && (
                          <div className="text-xs bg-muted/60 p-2 rounded-xl border max-w-sm space-y-1">
                            <div className="font-semibold text-foreground flex items-center gap-1">
                              <span>🍽️ Rompió con:</span>
                              <span className="font-normal text-muted-foreground">{item.firstMeal}</span>
                            </div>
                            {item.firstMealEvaluation && (
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {item.firstMealEvaluation}
                              </p>
                            )}
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 self-end sm:self-center"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          title="Eliminar este registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Aún no tienes registros en tu historial. ¡Completa tu primer ayuno para ver tus estadísticas!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: HABLAR CON EL AGENTE DOC */}
        <TabsContent value="doc" className="space-y-6">
          <Card className="border-emerald-500/30 shadow-2xl bg-card">
            <CardHeader className="bg-gradient-to-r from-emerald-950/40 via-slate-900/40 to-cyan-950/40 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    Doc IA — Médico Experto en Ayuno Intermitente
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      Súper Acceso API
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pregúntale a Doc cualquier duda sobre tus horas de ayuno, qué comer o pídele que inicie/finalice tus ayunos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Chat Message List */}
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {docMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      )}
                    >
                      {msg.role === "user" ? "Tú" : <Bot className="w-4 h-4" />}
                    </div>
                    <div
                      className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted/60 border rounded-tl-none text-foreground"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {sendingDoc && (
                  <div className="flex gap-3 max-w-[85%] mr-auto">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Bot className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="p-4 rounded-2xl text-sm bg-muted/60 border rounded-tl-none text-muted-foreground italic flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                      Doc está consultando tus métricas y elaborando su respuesta...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendDocMessage} className="p-4 border-t flex gap-2 bg-muted/20">
                <Input
                  value={docInput}
                  onChange={(e) => setDocInput(e.target.value)}
                  placeholder="Ej: ¿Puedo tomar agua con limón ahora? O: ¿En qué fase metabólica estoy?"
                  className="rounded-xl"
                  disabled={sendingDoc}
                />
                <Button
                  type="submit"
                  disabled={sendingDoc || !docInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 font-bold"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal / Dialog de Sensaciones y Primera Comida al finalizar el ayuno */}
      {feelingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl my-8">
            <div className="space-y-1 text-center">
              <h3 className="text-xl font-bold text-foreground">¡Ayuno Finalizado! 🎉</h3>
              <p className="text-xs text-muted-foreground">
                Registra tu experiencia y primera comida para que Doc IA evalúe tu transición metabólica.
              </p>
            </div>

            {/* Sensación General */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Sensación General</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "great", label: "Excelente", icon: Smile, color: "hover:border-emerald-500" },
                  { id: "good", label: "Bien", icon: Meh, color: "hover:border-blue-500" },
                  { id: "hard", label: "Duro", icon: Frown, color: "hover:border-amber-500" },
                ].map((f) => {
                  const IconComp = f.icon;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFeeling(f.id)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all",
                        selectedFeeling === f.id
                          ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 font-bold"
                          : "border-muted hover:bg-muted/40"
                      )}
                    >
                      <IconComp className="w-5 h-5 text-foreground" />
                      <span className="text-xs">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nivel de Energía y Claridad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 bg-muted/30 p-3 rounded-2xl border">
                <Label className="text-xs font-semibold flex items-center gap-1 text-foreground">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Energía ({energyLevel}/5)</span>
                </Label>
                <div className="flex gap-1 justify-between pt-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEnergyLevel(lvl)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold transition-all",
                        energyLevel === lvl
                          ? "bg-amber-500 text-white shadow-sm scale-110"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 bg-muted/30 p-3 rounded-2xl border">
                <Label className="text-xs font-semibold flex items-center gap-1 text-foreground">
                  <Flame className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Claridad / Foco ({clarityLevel}/5)</span>
                </Label>
                <div className="flex gap-1 justify-between pt-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setClarityLevel(lvl)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold transition-all",
                        clarityLevel === lvl
                          ? "bg-indigo-500 text-white shadow-sm scale-110"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Primera Comida (Fast Breaker) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1 text-foreground">
                <span>🥗 Primera Comida para Romper el Ayuno</span>
                <span className="text-muted-foreground font-normal text-[10px]">(Doc IA la evaluará)</span>
              </Label>
              <Input
                value={firstMeal}
                onChange={(e) => setFirstMeal(e.target.value)}
                placeholder="Ej: 3 huevos revueltos con aguacate y un puñado de nueces"
                className="rounded-xl text-sm"
              />
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Notas adicionales (Opcional)</Label>
              <Input
                value={fastNotes}
                onChange={(e) => setFastNotes(e.target.value)}
                placeholder="Sensaciones, agua tomada, entrenamiento en ayunas..."
                className="rounded-xl text-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="w-1/2 rounded-xl"
                onClick={() => setFeelingModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="w-1/2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
                onClick={handleEndFast}
              >
                Guardar y Finalizar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
