"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
}

const columns = [
  { id: "TODO", title: "Por hacer", color: "bg-slate-500" },
  { id: "INPROGRESS", title: "En progreso", color: "bg-blue-500" },
  { id: "INREVIEW", title: "En revisión", color: "bg-yellow-500" },
  { id: "DONE", title: "Hecho", color: "bg-green-500" },
];

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  MEDIUM: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
  HIGH: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  URGENT: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch {
      toast.error("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          description, 
          status, 
          priority,
          assignedTo: assignedTo || null 
        }),
      });

      if (response.ok) {
        const task = await response.json();
        setTasks([task, ...tasks]);
        setTitle("");
        setDescription("");
        setStatus("TODO");
        setPriority("NONE");
        setAssignedTo("");
        setOpen(false);
        toast.success("Tarea creada");
      }
    } catch {
      toast.error("Error al crear tarea");
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggedTask) return;

    // Optimistic update
    setTasks(tasks.map(t => 
      t.id === draggedTask.id ? { ...t, status: newStatus } : t
    ));

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draggedTask.id, status: newStatus }),
      });

      if (!response.ok) {
        // Revert on error
        setTasks(tasks.map(t => 
          t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t
        ));
        toast.error("Error al mover tarea");
      }
    } catch {
      // Revert on error
      setTasks(tasks.map(t => 
        t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t
      ));
      toast.error("Error al mover tarea");
    }

    setDraggedTask(null);
  };

  const getTasksByStatus = (status: string) => 
    tasks.filter(t => t.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Arrastra las tareas entre columnas para cambiar su estado
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Tarea</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Título de la tarea"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  placeholder="Descripción opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado inicial</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Asignar a (email)</Label>
                <Input
                  id="assignedTo"
                  placeholder="email@ejemplo.com"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Crear Tarea
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-1 min-w-[280px] max-w-[350px] flex flex-col"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={cn("w-3 h-3 rounded-full", column.color)} />
              <h3 className="font-medium text-sm">{column.title}</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {getTasksByStatus(column.id).length}
              </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 bg-muted/30 rounded-lg p-2 space-y-2 overflow-y-auto">
              {getTasksByStatus(column.id).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin tareas
                </div>
              ) : (
                getTasksByStatus(column.id).map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-background border-0 shadow-sm"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm leading-tight">
                          {task.title}
                        </h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {task.priority !== "NONE" && (
                          <Badge 
                            variant="secondary" 
                            className={cn("text-[10px] px-1.5 py-0 h-5", priorityColors[task.priority])}
                          >
                            {priorityLabels[task.priority]}
                          </Badge>
                        )}
                        
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {task.assignedTo && (
                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {task.assignedTo}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}