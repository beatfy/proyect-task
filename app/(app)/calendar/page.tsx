"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertCircle, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  projectId: string | null;
  project?: { id: string; name: string; color?: string } | null;
}

const statusIcons: Record<string, typeof Circle> = {
  TODO: Circle,
  INPROGRESS: Clock,
  INREVIEW: AlertCircle,
  DONE: CheckCircle2,
};

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const statusColors: Record<string, string> = {
  TODO: "text-slate-400",
  INPROGRESS: "text-blue-500",
  INREVIEW: "text-yellow-500",
  DONE: "text-green-500",
};

const priorityColors: Record<string, string> = {
  NONE: "",
  LOW: "border-l-slate-400",
  MEDIUM: "border-l-orange-500",
  HIGH: "border-l-red-500",
  URGENT: "border-l-purple-500",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      console.error("Error loading tasks");
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      return isSameDay(new Date(t.dueDate), day);
    });
  };

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

  // Count tasks per day for dots
  const getTaskCountForDay = (day: Date) => getTasksForDay(day).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium min-w-[150px] text-center text-foreground capitalize">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar — takes 2/3 */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Vista Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for alignment */}
              {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {days.map((day) => {
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const taskCount = getTaskCountForDay(day);
                const hasTasks = taskCount > 0;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "aspect-square p-1.5 text-sm rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 relative",
                      isToday(day) && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-card",
                      isSelected
                        ? "bg-indigo-500 text-white hover:bg-indigo-600"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <span className="leading-none">{format(day, "d")}</span>
                    {hasTasks && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(taskCount, 3) }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isSelected ? "bg-white/80" : "bg-indigo-500"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail panel — takes 1/3 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground">
              {selectedDay
                ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })
                : "Selecciona un día"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDay && (
              <p className="text-sm text-muted-foreground">
                Haz clic en un día del calendario para ver sus tareas
              </p>
            )}

            {selectedDay && loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {selectedDay && !loading && selectedDayTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Circle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Sin tareas para este día</p>
              </div>
            )}

            {selectedDay && !loading && selectedDayTasks.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  {selectedDayTasks.length} tarea{selectedDayTasks.length !== 1 ? "s" : ""}
                </p>
                {selectedDayTasks.map((task) => {
                  const StatusIcon = statusIcons[task.status] || Circle;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors border-l-4",
                        priorityColors[task.priority]
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <StatusIcon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", statusColors[task.status])} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            task.status === "DONE"
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {statusLabels[task.status]}
                            </span>
                            {task.project && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {task.project.name}
                              </span>
                            )}
                            {task.assignee && (
                              <span className="text-xs text-muted-foreground">
                                → {task.assignee.name || task.assignee.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
