"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Loader2,
  Plus,
  X,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organization-context";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
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

interface Project {
  id: string;
  name: string;
  color: string;
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
  URGENT: "border-l-purple-500 animate-pulse",
};

const priorityBgColors: Record<string, string> = {
  NONE: "",
  LOW: "",
  MEDIUM: "bg-orange-50 dark:bg-orange-950/30",
  HIGH: "bg-red-50 dark:bg-red-950/30",
  URGENT: "bg-purple-50 dark:bg-purple-950/30 ring-1 ring-purple-300 dark:ring-purple-700",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

// Draggable task chip
function DraggableTaskChip({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing transition-opacity",
        task.status === "DONE"
          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 line-through"
          : task.priority === "URGENT"
          ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold"
          : task.priority === "HIGH"
          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          : "bg-neutral-100 dark:bg-neutral-900/10 text-neutral-800 dark:text-neutral-500",
        isDragging && "opacity-40"
      )}
    >
      {task.title}
    </div>
  );
}

// Droppable day cell wrapper
function DroppableDayCell({
  day,
  children,
}: {
  day: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <div ref={setNodeRef} className={cn(isOver && "bg-neutral-900/10")}>
      {children}
    </div>
  );
}

// Task card used in detail panel / modal
function TaskCard({ task }: { task: Task }) {
  const StatusIcon = statusIcons[task.status] || Circle;
  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors border-l-4",
        priorityColors[task.priority],
        priorityBgColors[task.priority]
      )}
    >
      <div className="flex items-start gap-2">
        <StatusIcon
          className={cn(
            "h-4 w-4 mt-0.5 flex-shrink-0",
            statusColors[task.status]
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate",
                task.status === "DONE"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              )}
            >
              {task.title}
            </p>
            {(task.priority === "URGENT" || task.priority === "HIGH") && (
              <Flame
                className={cn(
                  "h-3.5 w-3.5 flex-shrink-0",
                  task.priority === "URGENT"
                    ? "text-purple-500 animate-pulse"
                    : "text-red-500"
                )}
              />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {statusLabels[task.status]}
            </span>
            {task.priority !== "NONE" && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  task.priority === "URGENT"
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                    : task.priority === "HIGH"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : task.priority === "MEDIUM"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                {priorityLabels[task.priority]}
              </span>
            )}
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
}

export default function CalendarPage() {
  const { organizations, selectedOrg, setSelectedOrg, loading: orgLoading } = useOrganization();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Inline create form
  const [creatingOnDay, setCreatingOnDay] = useState<Date | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("NONE");
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) setTasks(await res.json());
    } catch {
      console.error("Error loading tasks");
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      const res = await fetch(`/api/projects?${params}`);
      if (res.ok) setProjects(await res.json());
    } catch {}
  }, [selectedOrg]);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [fetchTasks, fetchProjects]);  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const getTasksForDay = (day: Date) =>
    tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(event.active.data.current?.task as Task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as Task;
    const newDateStr = over.id as string;
    if (!task || !newDateStr) return;

    const currentDue = task.dueDate
      ? new Date(task.dueDate).toISOString().split("T")[0]
      : null;
    if (currentDue === newDateStr) return;

    const newDate = new Date(newDateStr + "T12:00:00");
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, dueDate: newDate.toISOString() } : t
      )
    );

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, dueDate: newDate.toISOString() }),
      });
      toast.success(
        `Tarea movida al ${format(newDate, "d 'de' MMMM", { locale: es })}`
      );
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, dueDate: task.dueDate } : t
        )
      );
      toast.error("Error al mover tarea");
    }
  };

  // Inline task creation
  const handleStartCreate = (day: Date) => {
    setCreatingOnDay(day);
    setNewTitle("");
    setNewPriority("NONE");
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !creatingOnDay) return;
    setCreating(true);
    try {
      const dueDate = new Date(creatingOnDay);
      dueDate.setHours(12, 0, 0, 0);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          dueDate: dueDate.toISOString(),
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setNewTitle("");
        setNewPriority("NONE");
        setCreatingOnDay(null);
        toast.success("Tarea creada");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear tarea");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - responsive */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Calendario
        </h1>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base md:text-lg font-medium text-center text-foreground capitalize min-w-[100px] md:min-w-[140px]">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* Mobile FAB for creating task */}
          <Button
            size="icon"
            onClick={() => handleStartCreate(new Date())}
            className="h-9 w-9 md:hidden"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* ========== MOBILE COMPACT GRID (< md) ========== */}
        <div className="md:hidden">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {/* Day-of-week headers — 1 letter */}
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <div
                key={d}
                className="bg-card text-center text-[11px] font-semibold text-muted-foreground py-1.5"
              >
                {d}
              </div>
            ))}

            {/* Empty cells before month starts */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`e-${i}`} className="bg-card min-h-[48px]" />
            ))}

            {/* Day cells */}
            {days.map((day) => {
              const dayTasks = getTasksForDay(day);
              const dayStr = format(day, "yyyy-MM-dd");
              const today = isToday(day);

              return (
                <DroppableDayCell key={dayStr} day={dayStr}>
                  <button
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "bg-card min-h-[48px] w-full flex flex-col items-start p-1 relative transition-colors active:bg-accent",
                      today && "bg-accent"
                    )}
                  >
                    {/* Day number */}
                    <span
                      className={cn(
                        "text-[11px] font-medium leading-none",
                        today
                          ? "bg-foreground text-background w-5 h-5 rounded-full flex items-center justify-center"
                          : "text-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Dot indicators */}
                    {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {dayTasks.slice(0, 3).map((task) => {
                          const dotColor =
                            task.priority === "URGENT"
                              ? "bg-orange-500"
                              : task.priority === "HIGH"
                              ? "bg-red-500"
                              : task.priority === "MEDIUM"
                              ? "bg-yellow-500"
                              : task.priority === "LOW"
                              ? "bg-green-500"
                              : task.project?.color
                              ? undefined // handled below
                              : "bg-muted-foreground/40";
                          return (
                            <span
                              key={task.id}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                dotColor,
                                !dotColor &&
                                  "bg-muted-foreground/40"
                              )}
                              style={
                                !dotColor && task.project?.color
                                  ? { backgroundColor: task.project.color }
                                  : undefined
                              }
                            />
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <span className="text-[7px] text-muted-foreground leading-none">
                            +{dayTasks.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </DroppableDayCell>
              );
            })}
          </div>
        </div>

        {/* ========== DESKTOP/TABLET GRID VIEW (>= md) ========== */}
        <div className="hidden md:grid md:grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Vista Mensual</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden -mx-6 px-6">
              <div className="min-w-0">
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

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({
                    length: (monthStart.getDay() + 6) % 7,
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="aspect-[1.2] min-h-[80px]"
                    />
                  ))}

                  {days.map((day) => {
                    const dayTasks = getTasksForDay(day);
                    const isSelected =
                      selectedDay && isSameDay(day, selectedDay);
                    const dayStr = format(day, "yyyy-MM-dd");
                    const hasUrgent = dayTasks.some(
                      (t) => t.priority === "URGENT"
                    );
                    const isCreating =
                      creatingOnDay && isSameDay(day, creatingOnDay);

                    return (
                      <DroppableDayCell key={dayStr} day={dayStr}>
                        <div
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "aspect-[1.2] min-h-[80px] p-1 rounded-lg transition-colors border border-transparent flex flex-col cursor-pointer",
                            isToday(day) &&
                              "ring-2 ring-neutral-900 ring-offset-1 ring-offset-card",
                            isSelected
                              ? "bg-neutral-900/10 border-neutral-900/40"
                              : "hover:bg-accent",
                            hasUrgent &&
                              !isSelected &&
                              "border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => setSelectedDay(day)}
                              className={cn(
                                "text-xs font-medium leading-none px-1 py-0.5 rounded hover:bg-neutral-900/20",
                                isSelected &&
                                  "bg-neutral-900 text-white hover:bg-neutral-900"
                              )}
                            >
                              {format(day, "d")}
                            </button>
                            {!isCreating && (
                              <button
                                onClick={() => handleStartCreate(day)}
                                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="Crear tarea"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                            {dayTasks.slice(0, 3).map((task) => (
                              <DraggableTaskChip
                                key={task.id}
                                task={task}
                              />
                            ))}
                            {dayTasks.length > 3 && (
                              <span className="text-[9px] text-muted-foreground px-1">
                                +{dayTasks.length - 3} más
                              </span>
                            )}
                          </div>

                          {/* Inline create form */}
                          {isCreating && (
                            <div className="mt-1 space-y-1">
                              <Input
                                autoFocus
                                placeholder="Título..."
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleCreateTask();
                                  if (e.key === "Escape")
                                    setCreatingOnDay(null);
                                }}
                                className="h-6 text-xs bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                              />
                              <div className="flex gap-1">
                                <select
                                  value={newPriority}
                                  onChange={(e) =>
                                    setNewPriority(e.target.value)
                                  }
                                  className="h-5 text-[10px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1"
                                >
                                  {Object.entries(priorityLabels).map(
                                    ([v, l]) => (
                                      <option key={v} value={v}>
                                        {l}
                                      </option>
                                    )
                                  )}
                                </select>
                                <button
                                  onClick={handleCreateTask}
                                  disabled={creating}
                                  className="h-5 px-1.5 text-[10px] bg-neutral-900 text-white rounded hover:bg-neutral-900 disabled:opacity-50"
                                >
                                  {creating ? "..." : "OK"}
                                </button>
                                <button
                                  onClick={() => setCreatingOnDay(null)}
                                  className="h-5 px-1 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </DroppableDayCell>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day detail panel - Desktop only (lg+) */}
          <Card className="bg-card border-border hidden lg:block">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleStartCreate(selectedDay)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Crear tarea
                  </Button>
                </div>
              )}

              {selectedDay && !loading && selectedDayTasks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedDayTasks.length} tarea
                    {selectedDayTasks.length !== 1 ? "s" : ""}
                  </p>
                  {selectedDayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========== DAY DETAIL MODAL (mobile + tablet) ========== */}
        <Dialog
          open={!!selectedDay}
          onOpenChange={(open) => {
            if (!open) setSelectedDay(null);
          }}
        >
          <DialogContent className="lg:hidden bg-card border-border max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-foreground capitalize">
                {selectedDay
                  ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })
                  : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && selectedDayTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Circle className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin tareas para este día</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (selectedDay) handleStartCreate(selectedDay);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Crear tarea
                  </Button>
                </div>
              )}
              {!loading && selectedDayTasks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedDayTasks.length} tarea
                    {selectedDayTasks.length !== 1 ? "s" : ""}
                  </p>
                  {selectedDayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="bg-neutral-900 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium max-w-[200px] truncate">
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
