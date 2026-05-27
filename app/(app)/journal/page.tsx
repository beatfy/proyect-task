"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  TrendingUp, 
  StickyNote,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  Flame,
  Target,
  PenLine,
  Tag
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface JournalEntry {
  id: string;
  type: string;
  title: string | null;
  content: string;
  date: string;
  mood: string | null;
  completed: boolean;
  priority: string;
  tags: string[];
}

interface Habit {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  targetDays: number;
  logs: HabitLog[];
}

interface HabitLog {
  id: string;
  date: string;
  completed: boolean;
}

const MOODS = [
  { emoji: "😊", label: "Genial" },
  { emoji: "🙂", label: "Bien" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😔", label: "Bajón" },
  { emoji: "😤", label: "Productivo" },
  { emoji: "😴", label: "Cansado" },
];

export default function BulletJournalPage() {
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  // Daily form state
  const [dailyContent, setDailyContent] = useState("");
  const [dailyMood, setDailyMood] = useState<string | null>(null);
  const [dailyPriority, setDailyPriority] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entriesRes, habitsRes] = await Promise.all([
        fetch("/api/journal/entries"),
        fetch("/api/journal/habits"),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (habitsRes.ok) setHabits(await habitsRes.json());
    } catch (error) {
      console.error("Error loading journal data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEntryForDate = (date: Date, type: string) => {
    return entries.find(e => 
      e.type === type && isSameDay(new Date(e.date), date)
    );
  };

  const saveDailyEntry = async () => {
    const existing = getEntryForDate(selectedDate, "daily");
    setSaving(true);
    try {
      if (existing) {
        await fetch("/api/journal/entries", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing.id,
            content: dailyContent,
            mood: dailyMood,
          }),
        });
      } else {
        await fetch("/api/journal/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "daily",
            title: `Diario - ${format(selectedDate, "dd/MM/yyyy")}`,
            content: dailyContent,
            date: selectedDate.toISOString(),
            mood: dailyMood,
            priority: "NONE",
          }),
        });
      }
      toast.success("Entrada guardada");
      fetchData();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleHabit = async (habitId: string, date: Date) => {
    const habit = habits.find(h => h.id === habitId);
    const existingLog = habit?.logs.find(l => isSameDay(new Date(l.date), date));
    const newCompleted = !existingLog?.completed;

    try {
      await fetch("/api/journal/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId,
          date: date.toISOString(),
          completed: newCompleted,
        }),
      });
      fetchData();
    } catch {
      toast.error("Error al actualizar hábito");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--mediterranean-terracotta)]"></div>
      </div>
    );
  }

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
    end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
  });

  const monthDays = eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-[var(--mediterranean-terracotta)]" />
            Bullet Journal
          </h1>
          <p className="text-muted-foreground mt-1">
            Organiza tu día, semana y hábitos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {format(selectedDate, "dd MMM", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="daily" className="flex items-center gap-1">
            <PenLine className="h-4 w-4" /> Diario
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Semanal
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-1">
            <Target className="h-4 w-4" /> Mensual
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> Hábitos
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1">
            <StickyNote className="h-4 w-4" /> Notas
          </TabsTrigger>
        </TabsList>

        {/* DAILY TAB */}
        <TabsContent value="daily" className="space-y-4">
          <Card className="card-mediterranean">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}</span>
                <Button size="sm" onClick={saveDailyEntry} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </CardTitle>
            </CardHeader>            <CardContent className="space-y-4">
              {/* Mood selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">¿Cómo te sientes hoy?</Label>
                <div className="flex gap-2">
                  {MOODS.map((mood) => (
                    <button
                      key={mood.emoji}
                      onClick={() => setDailyMood(mood.emoji)}
                      className={cn(
                        "text-2xl p-2 rounded-lg transition-all hover:scale-110",
                        dailyMood === mood.emoji 
                          ? "bg-[var(--mediterranean-terracotta)]/20 ring-2 ring-[var(--mediterranean-terracotta)]" 
                          : "bg-muted hover:bg-accent"
                      )}
                      title={mood.label}
                    >
                      {mood.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick tasks */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tareas rápidas</Label>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <Input 
                        placeholder={`Tarea ${i}`}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Journal content */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reflexión del día</Label>
                <Textarea
                  value={dailyContent}
                  onChange={(e) => setDailyContent(e.target.value)}
                  placeholder="Escribe lo que hiciste, aprendiste o reflexionaste..."
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Prioridad del día</Label>
                <Input
                  value={dailyPriority}
                  onChange={(e) => setDailyPriority(e.target.value)}
                  placeholder="Lo más importante de hoy..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEEKLY TAB */}
        <TabsContent value="weekly" className="space-y-4">
          <Card className="card-mediterranean">
            <CardHeader>
              <CardTitle className="text-lg">
                Semana del {format(weekDays[0], "d")} al {format(weekDays[6], "d 'de' MMMM", { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((day, i) => {
                  const dayEntry = getEntryForDate(day, "daily");
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div 
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border min-h-[120px] cursor-pointer transition-all",
                        isToday 
                          ? "border-[var(--mediterranean-terracotta)] bg-[var(--mediterranean-terracotta)]/5" 
                          : "border-border bg-card hover:bg-accent/50",
                        selectedDate && isSameDay(day, selectedDate) && "ring-2 ring-[var(--mediterranean-terracotta)]"
                      )}
                      onClick={() => {
                        setSelectedDate(day);
                        setActiveTab("daily");
                      }}
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {format(day, "EEE", { locale: es })}
                      </div>
                      <div className={cn(
                        "text-lg font-bold mb-2",
                        isToday && "text-[var(--mediterranean-terracotta)]"
                      )}>
                        {format(day, "d")}
                      </div>
                      {dayEntry?.mood && (
                        <div className="text-lg">{dayEntry.mood}</div>
                      )}
                      {dayEntry?.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {dayEntry.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Weekly goals */}
              <div className="mt-6 space-y-3">
                <Label className="text-sm font-medium">Objetivos de la semana</Label>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[var(--mediterranean-terracotta)]" />
                      <Input placeholder={`Objetivo ${i}`} className="flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONTHLY TAB */}
        <TabsContent value="monthly" className="space-y-4">
          <Card className="card-mediterranean">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                {format(selectedDate, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const dayEntry = getEntryForDate(day, "daily");
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setActiveTab("daily");
                      }}
                      className={cn(
                        "aspect-square p-2 rounded-lg border text-sm transition-all hover:shadow-md",
                        isToday 
                          ? "border-[var(--mediterranean-terracotta)] bg-[var(--mediterranean-terracotta)]/10 text-[var(--mediterranean-terracotta)] font-bold" 
                          : "border-border bg-card hover:border-[var(--mediterranean-terracotta)]/50"
                      )}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span>{format(day, "d")}</span>
                        {dayEntry?.mood && (
                          <span className="text-xs mt-0.5">{dayEntry.mood}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Monthly goals */}
              <div className="mt-6 space-y-3">
                <Label className="text-sm font-medium">Objetivos del mes</Label>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-[var(--mediterranean-terracotta)]" />
                      <Input placeholder={`Meta mensual ${i}`} className="flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HABITS TAB */}
        <TabsContent value="habits" className="space-y-4">
          <Card className="card-mediterranean">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Tracker de Hábitos</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nuevo Hábito
              </Button>
            </CardHeader>
            <CardContent>
              {habits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No tienes hábitos configurados</p>
                  <Button className="mt-3" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Crear primer hábito
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {habits.map((habit) => {
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                      const date = subDays(new Date(), 6 - i);
                      const log = habit.logs.find(l => isSameDay(new Date(l.date), date));
                      return { date, completed: log?.completed || false };
                    });

                    return (
                      <div key={habit.id} className="p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{habit.icon || "🔥"}</span>
                            <span className="font-medium">{habit.name}</span>
                          </div>
                          <Badge variant="outline">
                            {habit.logs.filter(l => l.completed).length}/{habit.targetDays}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {last7Days.map(({ date, completed }, i) => (
                            <button
                              key={i}
                              onClick={() => toggleHabit(habit.id, date)}
                              className={cn(
                                "w-10 h-10 rounded-lg border-2 transition-all hover:scale-110",
                                completed 
                                  ? "border-[var(--mediterranean-terracotta)] bg-[var(--mediterranean-terracotta)] text-white" 
                                  : "border-border bg-card hover:border-[var(--mediterranean-terracotta)]/50"
                              )}
                              title={format(date, "EEE d", { locale: es })}
                            >
                              <span className="text-xs">{format(date, "d")}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes" className="space-y-4">
          <Card className="card-mediterranean">
            <CardHeader>
              <CardTitle className="text-lg">Notas Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Brain dump - Escribe todo lo que te venga a la mente..."
                rows={10}
                className="resize-none"
              />
              <div className="flex justify-between">
                <Button variant="outline">
                  <Trash2 className="h-4 w-4 mr-1" /> Limpiar
                </Button>
                <Button>
                  <Save className="h-4 w-4 mr-1" /> Guardar Nota
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
