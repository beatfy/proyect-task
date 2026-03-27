"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, Calendar, User, Pencil, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  projectId: string | null;
  project?: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

const columns = [
  { id: "TODO", title: "Por hacer", color: "bg-slate-500" },
  { id: "INPROGRESS", title: "En progreso", color: "bg-blue-500" },
  { id: "INREVIEW", title: "En revisión", color: "bg-yellow-500" },
  { id: "DONE", title: "Hecho", color: "bg-green-500" },
];

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-500/20 text-white border-gray-500/30",
  LOW: "bg-slate-500/20 text-white border-slate-500/30",
  MEDIUM: "bg-orange-500/20 text-white border-orange-500/30",
  HIGH: "bg-red-500/20 text-white border-red-500/30",
  URGENT: "bg-purple-500/20 text-white border-purple-500/30",
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    fetchTasks();
    fetchProjects();
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

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch {
      // Ignore
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("TODO");
    setPriority("NONE");
    setAssignedTo("");
    setProjectId("");
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
          assignedTo: assignedTo || null,
          projectId: projectId || null
        }),
      });

      if (response.ok) {
        const task = await response.json();
        setTasks([task, ...tasks]);
        resetForm();
        setOpen(false);
        toast.success("Tarea creada");
      }
    } catch {
      toast.error("Error al crear tarea");
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssignedTo(task.assignedTo || "");
    setProjectId(task.projectId || "");
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTask || !title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: editingTask.id,
          title, 
          description, 
          status, 
          priority,
          assignedTo: assignedTo || null,
          projectId: projectId || null
        }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map(t => t.id === editingTask.id ? updatedTask : t));
        resetForm();
        setEditOpen(false);
        setEditingTask(null);
        toast.success("Tarea actualizada");
      }
    } catch {
      toast.error("Error al actualizar tarea");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta tarea?")) return;

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
        toast.success("Tarea eliminada");
      }
    } catch {
      toast.error("Error al eliminar tarea");
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

    setTasks(tasks.map(t => 
      t.id === draggedTask.id ? { ...t, status: newStatus } : t
    ));

    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draggedTask.id, status: newStatus }),
      });
    } catch {
      setTasks(tasks.map(t => 
        t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t
      ));
      toast.error("Error al mover tarea");
    }

    setDraggedTask(null);
  };

  const getTasksByStatus = (status: string) => 
    tasks.filter(t => t.status === status);

  const getProjectName = (id: string | null) => {
    if (!id) return null;
    const project = projects.find(p => p.id === id);
    return project?.name || null;
  };

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
          <h1 className="text-2xl font-semibold text-white">Tareas</h1>
          <p className="text-gray-400 text-sm mt-1">
            Arrastra las tareas entre columnas para cambiar su estado
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </Dialog>
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Crear Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-white">Título</Label>
              <Input
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="">Sin proyecto</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Estado inicial</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Asignar a (email)</Label>
              <Input
                placeholder="email@ejemplo.com"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button onClick={handleCreate} className="w-full">
              Crear Tarea
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { resetForm(); setEditingTask(null); }}}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-white">Título</Label>
              <Input
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="">Sin proyecto</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Asignar a (email)</Label>
              <Input
                placeholder="email@ejemplo.com"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button onClick={handleUpdate} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <h3 className="font-medium text-sm text-white">{column.title}</h3>
              <span className="text-xs text-gray-400 ml-auto">
                {getTasksByStatus(column.id).length}
              </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 bg-zinc-900/50 rounded-lg p-2 space-y-2 overflow-y-auto">
              {getTasksByStatus(column.id).length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Sin tareas
                </div>
              ) : (
                getTasksByStatus(column.id).map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-zinc-800 border-zinc-700"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm leading-tight text-white">
                          {task.title}
                        </h4>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-zinc-700">
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                            <DropdownMenuItem 
                              onClick={() => handleEdit(task)}
                              className="text-white hover:bg-zinc-700 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(task.id)}
                              className="text-red-400 hover:bg-zinc-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {task.priority !== "NONE" && (
                          <Badge 
                            variant="secondary" 
                            className={cn("text-[10px] px-1.5 py-0 h-5 border", priorityColors[task.priority])}
                          >
                            {priorityLabels[task.priority]}
                          </Badge>
                        )}
                        
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Project */}
                      {(task.project?.name || getProjectName(task.projectId)) && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <FolderOpen className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {task.project?.name || getProjectName(task.projectId)}
                          </span>
                        </div>
                      )}

                      {/* Assignee */}
                      {task.assignedTo && (
                        <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-700">
                          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="h-3 w-3 text-blue-400" />
                          </div>
                          <span className="text-xs text-gray-400 truncate">
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