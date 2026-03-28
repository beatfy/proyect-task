"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, User, Pencil, Trash2, FolderOpen, LayoutGrid, List, Table, Calendar, MessageSquare, Paperclip, ChevronDown, ChevronUp, X, Upload, File, Image, FileText } from "lucide-react";
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
  assignee?: { id: string; name: string | null; email: string } | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  parentId?: string | null;
}

interface Subtask extends Task {}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string; image?: string | null };
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number | null;
  createdAt: string;
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
  NONE: "bg-gray-100 text-gray-600 border-gray-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-orange-100 text-orange-600 border-orange-200",
  HIGH: "bg-red-100 text-red-600 border-red-200",
  URGENT: "bg-purple-100 text-purple-600 border-purple-200",
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
  TODO: "bg-gray-100 text-gray-600 border-gray-200",
  INPROGRESS: "bg-blue-100 text-blue-600 border-blue-200",
  INREVIEW: "bg-yellow-100 text-yellow-600 border-yellow-200",
  DONE: "bg-green-100 text-green-600 border-green-200",
};

type ViewType = "kanban" | "list" | "table";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>("kanban");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("none");

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(true);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

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
        setTasks(data.filter((t: Task) => !t.parentId)); // Only main tasks
      }
    } catch {
      console.error("Error loading tasks");
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

  const fetchTaskDetails = async (taskId: string) => {
    // Fetch subtasks
    const subRes = await fetch(`/api/tasks?parentId=${taskId}`);
    if (subRes.ok) setSubtasks(await subRes.json());

    // Fetch comments
    const comRes = await fetch(`/api/comments?taskId=${taskId}`);
    if (comRes.ok) setComments(await comRes.json());

    // Fetch attachments
    const attRes = await fetch(`/api/attachments?taskId=${taskId}`);
    if (attRes.ok) setAttachments(await attRes.json());
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
    } catch {
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

  const handleOpenDetail = (task: Task) => {
    setDetailTask(task);
    setDetailOpen(true);
    fetchTaskDetails(task.id);
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

  // Subtasks
  const handleCreateSubtask = async () => {
    if (!subtaskTitle.trim() || !detailTask) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subtaskTitle,
          parentId: detailTask.id,
          projectId: detailTask.projectId
        })
      });

      if (res.ok) {
        const subtask = await res.json();
        setSubtasks([...subtasks, subtask]);
        setSubtaskTitle("");
        toast.success("Subtarea creada");
      }
    } catch {
      toast.error("Error al crear subtarea");
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    const newStatus = subtask.status === "DONE" ? "TODO" : "DONE";
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subtask.id, status: newStatus })
      });
      setSubtasks(subtasks.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s));
    } catch {
      toast.error("Error al actualizar");
    }
  };

  // Comments
  const handleAddComment = async () => {
    if (!newComment.trim() || !detailTask) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: detailTask.id, content: newComment })
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment("");
      }
    } catch {
      toast.error("Error al añadir comentario");
    }
  };

  // Attachments
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailTask) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", detailTask.id);

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const att = await res.json();
        setAttachments([...attachments, att]);
        toast.success("Archivo subido");
      } else {
        toast.error("Error al subir archivo");
      }
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      setAttachments(attachments.filter(a => a.id !== id));
      toast.success("Archivo eliminado");
    } catch {
      toast.error("Error al eliminar archivo");
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

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tareas</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona todas tus tareas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200">
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
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Crear Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Título</Label>
              <Input
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Asignar a (email)</Label>
              <Input
                placeholder="email@ejemplo.com"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
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
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Título</Label>
              <Input
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Descripción</Label>
              <Input
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <Button onClick={handleUpdate} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTask(null); }}>
        <DialogContent className="bg-white border-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{detailTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {/* Description */}
            {detailTask?.description && (
              <div className="text-slate-600">{detailTask.description}</div>
            )}

            {/* Subtasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowSubtasks(!showSubtasks)}>
                <h3 className="font-medium text-slate-700 flex items-center gap-2">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSubtasks ? "" : "-rotate-90"}`} />
                  Subtareas ({subtasks.length})
                </h3>
                <Input
                  placeholder="Añadir subtarea..."
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  className="w-64 bg-white border-slate-300 text-slate-900"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubtask(); }}
                />
              </div>
              {showSubtasks && (
                <div className="space-y-2 ml-4">
                  {subtasks.length === 0 ? (
                    <p className="text-slate-500 text-sm">No hay subtareas</p>
                  ) : (
                    subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <input
                          type="checkbox"
                          checked={st.status === "DONE"}
                          onChange={() => handleToggleSubtask(st)}
                          className="rounded border-slate-300"
                        />
                        <span className={cn("text-sm", st.status === "DONE" && "text-slate-400 line-through")}>
                          {st.title}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={async () => {
                          await fetch(`/api/tasks?id=${st.id}`, { method: "DELETE" });
                          setSubtasks(subtasks.filter(s => s.id !== st.id));
                        }}>
                          <Trash2 className="h-3 w-3 text-slate-400" />
                        </Button>
                      </div>
                    ))
                  )}
                  {subtaskTitle.trim() && (
                    <Button size="sm" onClick={handleCreateSubtask}>Añadir</Button>
                  )}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentarios ({comments.length})
              </h3>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
                        {c.author.name?.[0]?.toUpperCase() || c.author.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{c.author.name || c.author.email}</span>
                      <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.content}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Añadir comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900"
                  />
                  <Button size="sm" onClick={handleAddComment}>Enviar</Button>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Archivos ({attachments.length})
              </h3>
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                    {a.type === "image" ? (
                      <Image className="h-5 w-5 text-blue-500" />
                    ) : a.type === "pdf" ? (
                      <FileText className="h-5 w-5 text-red-500" />
                    ) : (
                      <File className="h-5 w-5 text-slate-500" />
                    )}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 hover:underline">
                      {a.name}
                    </a>
                    <span className="text-xs text-slate-400">{formatBytes(a.size)}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => handleDeleteAttachment(a.id)}>
                      <Trash2 className="h-3 w-3 text-slate-400" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    <Button variant="outline" size="sm" asChild disabled={uploading}>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Subiendo..." : "Subir archivo"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
          {columns.map((column) => (
            <div key={column.id} className="flex-1 min-w-[280px] max-w-[350px] flex flex-col" onDragOver={handleDragOver} onDrop={() => handleDrop(column.id)}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={cn("w-3 h-3 rounded-full", column.color)} />
                <h3 className="font-medium text-sm text-slate-700">{column.title}</h3>
                <span className="text-xs text-slate-400 ml-auto">{getTasksByStatus(column.id).length}</span>
              </div>
              <div className="flex-1 bg-white rounded-lg p-2 space-y-2 overflow-y-auto border border-slate-200">
                {getTasksByStatus(column.id).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Sin tareas</div>
                ) : (
                  getTasksByStatus(column.id).map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={() => handleOpenDetail(task)}
                      className="cursor-pointer hover:shadow-md transition-shadow bg-slate-50 border-slate-200"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm leading-tight text-slate-900">{task.title}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border-slate-200">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(task); }} className="text-slate-700 hover:bg-slate-100 cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-red-500 hover:bg-slate-100 cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {task.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {task.priority !== "NONE" && (
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 border", priorityColors[task.priority])}>
                              {priorityLabels[task.priority]}
                            </Badge>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        {(task.project?.name || getProjectName(task.projectId)) && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <FolderOpen className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-500">{task.project?.name || getProjectName(task.projectId)}</span>
                          </div>
                        )}
                        {task.assignedTo && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-3 w-3 text-blue-500" />
                            </div>
                            <span className="text-xs text-slate-500 truncate">{task.assignedTo}</span>
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
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Tarea</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Estado</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Prioridad</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Fecha límite</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Proyecto</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Asignado</th>
                <th className="text-right p-3 text-sm font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No hay tareas</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleOpenDetail(task)}>
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-slate-900">{task.title}</p>
                        {task.description && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[300px]">{task.description}</p>}
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
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-600">{task.project?.name || getProjectName(task.projectId) || "-"}</td>
                    <td className="p-3 text-sm text-slate-600">{task.assignedTo || "-"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(task); }} className="h-8 w-8 p-0 hover:bg-slate-100">
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="h-8 w-8 p-0 hover:bg-slate-100">
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
            <Card className="bg-white border-slate-200">
              <CardContent className="py-12 text-center text-slate-500">No hay tareas</CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="bg-white border-slate-200 hover:border-slate-300 transition-colors cursor-pointer" onClick={() => handleOpenDetail(task)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", columns.find(c => c.id === task.status)?.color)} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-slate-900 truncate">{task.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="secondary" className={cn("text-[10px] border", statusColors[task.status])}>{statusLabels[task.status]}</Badge>
                          {task.priority !== "NONE" && (
                            <Badge variant="secondary" className={cn("text-[10px] border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                          )}
                          {task.dueDate && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {(task.project?.name || getProjectName(task.projectId)) && (
                            <span className="text-xs text-slate-500">{task.project?.name || getProjectName(task.projectId)}</span>
                          )}
                          {task.assignedTo && (
                            <span className="text-xs text-slate-500 flex items-center gap-1"><User className="h-3 w-3" />{task.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-8 w-8 p-0 hover:bg-slate-100">
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="h-8 w-8 p-0 hover:bg-slate-100">
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