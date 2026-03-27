"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, User, Pencil, Trash2, FolderOpen, LayoutGrid, List, Table, Calendar } from "lucide-react";
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

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const statusColors: Record<string, string> = {
  TODO: "bg-gray-500/20 text-white border-gray-500/30",
  INPROGRESS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  INREVIEW: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  DONE: "bg-green-500/20 text-green-300 border-green-500/30",
};

type ViewType = "kanban" | "list" | "table";

// MOVED OUTSIDE: TaskDialog component
function TaskDialog({
  open,
  onOpenChange,
  mode,
  title,
  setTitle,
  description,
  setDescription,
  status,
  setStatus,
  priority,
  setPriority,
  dueDate,
  setDueDate,
  assignedTo,
  setAssignedTo,
  projectId,
  setProjectId,
  projects,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  assignedTo: string;
  setAssignedTo: (v: string) => void;
  projectId: string;
  setProjectId: (v: string) => void;
  projects: Project[];
  onSubmit: () => void;
}) {
  return (
    <DialogContent className="bg-white border-gray-200">
      <DialogHeader>
        <DialogTitle className="text-gray-900">{mode === "create" ? "Crear Tarea" : "Editar Tarea"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-gray-700">Título</Label>
          <Input
            placeholder="Título de la tarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700">Descripción</Label>
          <Input
            placeholder="Descripción opcional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700">Proyecto</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
              <SelectValue placeholder="Sin proyecto" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="none">Sin proyecto</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {Object.entries(priorityLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700">Fecha de finalización</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700">Asignar a (email)</Label>
          <Input
            placeholder="email@ejemplo.com"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <Button onClick={onSubmit} className="w-full">
          {mode === "create" ? "Crear Tarea" : "Guardar Cambios"}
        </Button>
      </div>
    </DialogContent>
  );
}

// MOVED OUTSIDE: TaskCard component
function TaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
  getProjectName,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDragStart: (task: Task) => void;
  getProjectName: (id: string | null) => string | null;
}) {
  return (
    <Card
      draggable
      onDragStart={() => onDragStart(task)}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-white border-gray-200"
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm leading-tight text-gray-900">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-gray-200">
              <DropdownMenuItem onClick={() => onEdit(task)} className="text-gray-700 hover:bg-gray-100 cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-500 hover:bg-gray-100 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {task.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {task.priority !== "NONE" && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 border", priorityColors[task.priority])}>
              {priorityLabels[task.priority]}
            </Badge>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        {(task.project?.name || getProjectName(task.projectId)) && (
          <div className="flex items-center gap-1.5 mb-2">
            <FolderOpen className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">{task.project?.name || getProjectName(task.projectId)}</span>
          </div>
        )}
        {task.assignedTo && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-3 w-3 text-blue-500" />
            </div>
            <span className="text-xs text-gray-500 truncate">{task.assignedTo}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>("kanban");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("none");

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks");
      if (response.status === 401) {
        setTasks([]);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
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
    } catch {}
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("TODO");
    setPriority("NONE");
    setDueDate("");
    setAssignedTo("");
    setProjectId("none");
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
          title, description, status, priority,
          dueDate: dueDate || null,
          assignedTo: assignedTo || null, projectId: projectId === "none" ? null : projectId || null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear tarea");
        return;
      }

      setTasks([data, ...tasks]);
      resetForm();
      setOpen(false);
      toast.success("Tarea creada");
    } catch (error) {
      console.error("Create task error:", error);
      toast.error("Error de conexión");
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setAssignedTo(task.assignedTo || "");
    setProjectId(task.projectId || "none");
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
          id: editingTask.id, title, description, status, priority,
          dueDate: dueDate || null,
          assignedTo: assignedTo || null, projectId: projectId === "none" ? null : projectId || null
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
      const response = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
        toast.success("Tarea eliminada");
      }
    } catch {
      toast.error("Error al eliminar tarea");
    }
  };

  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (newStatus: string) => {
    if (!draggedTask) return;
    setTasks(tasks.map(t => t.id === draggedTask.id ? { ...t, status: newStatus } : t));
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draggedTask.id, status: newStatus }),
      });
    } catch {
      setTasks(tasks.map(t => t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t));
      toast.error("Error al mover tarea");
    }
    setDraggedTask(null);
  };

  const getTasksByStatus = (s: string) => tasks.filter(t => t.status === s);
  const getProjectName = (id: string | null) => {
    if (!id) return null;
    return projects.find(p => p.id === id)?.name || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tareas</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona todas tus tareas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")} className="h-8 px-3">
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="h-8 px-3">
              <Table className="h-4 w-4 mr-1" /> Tabla
            </Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")} className="h-8 px-3">
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
          </div>
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <TaskDialog
          open={open}
          onOpenChange={setOpen}
          mode="create"
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          dueDate={dueDate}
          setDueDate={setDueDate}
          assignedTo={assignedTo}
          setAssignedTo={setAssignedTo}
          projectId={projectId}
          setProjectId={setProjectId}
          projects={projects}
          onSubmit={handleCreate}
        />
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { resetForm(); setEditingTask(null); }}}>
        <TaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          dueDate={dueDate}
          setDueDate={setDueDate}
          assignedTo={assignedTo}
          setAssignedTo={setAssignedTo}
          projectId={projectId}
          setProjectId={setProjectId}
          projects={projects}
          onSubmit={handleUpdate}
        />
      </Dialog>

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
          {columns.map((column) => (
            <div key={column.id} className="flex-1 min-w-[280px] max-w-[350px] flex flex-col" onDragOver={handleDragOver} onDrop={() => handleDrop(column.id)}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={cn("w-3 h-3 rounded-full", column.color)} />
                <h3 className="font-medium text-sm text-gray-700">{column.title}</h3>
                <span className="text-xs text-gray-400 ml-auto">{getTasksByStatus(column.id).length}</span>
              </div>
              <div className="flex-1 bg-white rounded-lg p-2 space-y-2 overflow-y-auto border border-gray-200">
                {getTasksByStatus(column.id).length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Sin tareas</div>
                ) : (
                  getTasksByStatus(column.id).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onDragStart={handleDragStart}
                      getProjectName={getProjectName}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Tarea</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Prioridad</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Fecha límite</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Proyecto</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Asignado</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No hay tareas</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[300px]">{task.description}</p>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={cn("border", statusColors[task.status])}>{statusLabels[task.status]}</Badge>
                    </td>
                    <td className="p-3">
                      {task.priority !== "NONE" && (
                        <Badge variant="secondary" className={cn("border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{task.project?.name || getProjectName(task.projectId) || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">{task.assignedTo || "-"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-8 w-8 p-0 hover:bg-gray-100">
                          <Pencil className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="h-8 w-8 p-0 hover:bg-gray-100">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <Card className="bg-white border-gray-200">
              <CardContent className="py-12 text-center text-gray-500">No hay tareas</CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="bg-white border-gray-200 hover:border-gray-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", columns.find(c => c.id === task.status)?.color)} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="secondary" className={cn("text-[10px] border", statusColors[task.status])}>{statusLabels[task.status]}</Badge>
                          {task.priority !== "NONE" && (
                            <Badge variant="secondary" className={cn("text-[10px] border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                          )}
                          {task.dueDate && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {(task.project?.name || getProjectName(task.projectId)) && (
                            <span className="text-xs text-gray-500">{task.project?.name || getProjectName(task.projectId)}</span>
                          )}
                          {task.assignedTo && (
                            <span className="text-xs text-gray-500 flex items-center gap-1"><User className="h-3 w-3" />{task.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-8 w-8 p-0 hover:bg-gray-100">
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="h-8 w-8 p-0 hover:bg-gray-100">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}