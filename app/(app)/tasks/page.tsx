"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, MoreHorizontal, User, Pencil, Trash2, FolderOpen, LayoutGrid, List, Table, Calendar, MessageSquare, Paperclip, ChevronDown, ChevronUp, X, Upload, File, Image, FileText, Timer, Play, Square, LayoutTemplate } from "lucide-react";
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

interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[] | null;
  isDefault: boolean;
}

interface TimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
}

const columns = [
  { id: "TODO", title: "Por hacer", color: "bg-slate-500" },
  { id: "INPROGRESS", title: "En progreso", color: "bg-blue-500" },
  { id: "INREVIEW", title: "En revisión", color: "bg-yellow-500" },
  { id: "DONE", title: "Hecho", color: "bg-green-500" },
];

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  LOW: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  MEDIUM: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  HIGH: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  URGENT: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
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
  TODO: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  INPROGRESS: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  INREVIEW: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  DONE: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
};

type ViewType = "kanban" | "list" | "table";

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>(typeof window !== 'undefined' && window.innerWidth < 768 ? "list" : "kanban");
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
  const [projectMembers, setProjectMembers] = useState<{id:string; role:string; user:{id:string; name:string|null; email:string; image:string|null}}[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

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

  // Templates
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Timer
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchTemplates();
    fetchActiveTimer();
  }, []);

  // Fetch members when project changes
  useEffect(() => {
    if (projectId && projectId !== "none") {
      fetch(`/api/projects/${projectId}/members`)
        .then(r => r.ok ? r.json() : [])
        .then(setProjectMembers)
        .catch(() => setProjectMembers([]));
    } else {
      setProjectMembers([]);
    }
    setAssigneeIds([]);
  }, [projectId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {}
  };

  const fetchActiveTimer = async () => {
    try {
      const res = await fetch("/api/time-entries?userId=me");
      if (res.ok) {
        const entries: TimeEntry[] = await res.json();
        const running = entries.find((e) => !e.endTime);
        if (running) {
          setActiveTimer(running);
          const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
          setTimerSeconds(elapsed);
        }
        setTimeEntries(entries.filter((e) => e.endTime));
      }
    } catch {}
  };

  // Timer tick
  useEffect(() => {
    if (activeTimer) {
      timerInterval.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
      setTimerSeconds(0);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [activeTimer]);

  const handleStartTimer = async (taskId: string) => {
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "start" }),
      });
      if (res.ok) {
        const entry = await res.json();
        setActiveTimer(entry);
        setTimerSeconds(0);
        toast.success("Timer iniciado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al iniciar timer");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeTimer.id, action: "stop" }),
      });
      if (res.ok) {
        const stopped = await res.json();
        setTimeEntries([stopped, ...timeEntries]);
        setActiveTimer(null);
        setTimerSeconds(0);
        toast.success(`Timer detenido — ${formatTimer(stopped.duration || 0)}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al detener timer");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const applyTemplate = (tmpl: TaskTemplate) => {
    setTitle(tmpl.title);
    setDescription(tmpl.description || "");
    setStatus(tmpl.status);
    setPriority(tmpl.priority);
    setTemplatesOpen(false);
    setOpen(true);
    toast.success(`Template "${tmpl.name}" aplicado`);
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks");
      if (response.status === 401) {
        setTasks([]);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setTasks(data.filter((t: Task) => !t.parentId));
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
    const subRes = await fetch(`/api/tasks?parentId=${taskId}`);
    if (subRes.ok) setSubtasks(await subRes.json());

    const comRes = await fetch(`/api/comments?taskId=${taskId}`);
    if (comRes.ok) setComments(await comRes.json());

    const attRes = await fetch(`/api/attachments?taskId=${taskId}`);
    if (attRes.ok) setAttachments(await attRes.json());

    // Fetch time entries for this task
    try {
      const teRes = await fetch(`/api/time-entries?taskId=${taskId}`);
      if (teRes.ok) {
        const entries: TimeEntry[] = await teRes.json();
        setTimeEntries(entries.filter((e) => e.endTime));
        const running = entries.find((e) => !e.endTime);
        if (running) {
          setActiveTimer(running);
          const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
          setTimerSeconds(elapsed);
        }
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
    setAssigneeIds([]);
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getMemberName = (userId: string) => {
    const m = projectMembers.find(m => m.user.id === userId);
    return m ? (m.user.name || m.user.email) : userId;
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
          assignedTo: assignedTo || null, projectId: projectId === "none" ? null : projectId || null,
          assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined
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

  const MAX_CLIENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB (imágenes se comprimen antes)
  const COMPRESS_THRESHOLD = 4 * 1024 * 1024; // Comprimir si es mayor a 4MB

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !detailTask) return;

    // Validación client-side de tamaño (antes de comprimir)
    if (rawFile.size > MAX_CLIENT_FILE_SIZE) {
      toast.error(`El archivo supera el límite de 10MB (${(rawFile.size / 1024 / 1024).toFixed(1)}MB). Reduce el tamaño o comprime la imagen.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      // Comprimir imagen si es grande
      let fileToUpload = rawFile;
      if (rawFile.type.startsWith("image/") && rawFile.size > COMPRESS_THRESHOLD) {
        try {
          const { compressImageIfNeeded } = await import("@/lib/image-compress");
          fileToUpload = await compressImageIfNeeded(rawFile, {
            maxDimension: 1920,
            quality: 0.8,
            maxFileSize: COMPRESS_THRESHOLD,
          });
        } catch {
          // Si la compresión falla, subir original si cabe
          if (rawFile.size > 4 * 1024 * 1024) {
            toast.error("No se pudo comprimir la imagen. Intenta con una imagen más pequeña.");
            setUploading(false);
            e.target.value = "";
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
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
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al subir archivo");
      }
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
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

  const totalTaskTime = timeEntries
    .filter((e) => detailTask && e.taskId === detailTask.id)
    .reduce((sum, e) => sum + (e.duration || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tareas</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestiona todas tus tareas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile view selector - dropdown */}
          <Select value={view} onValueChange={(v: ViewType) => setView(v)}>
            <SelectTrigger className="w-[140px] md:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <SelectItem value="kanban">Kanban</SelectItem>
              <SelectItem value="table">Tabla</SelectItem>
              <SelectItem value="list">Lista</SelectItem>
            </SelectContent>
          </Select>

          {/* Desktop view selector - buttons */}
          <div className="hidden md:flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
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

          {/* Templates Dropdown - Desktop only */}
          <DropdownMenu open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DropdownMenuTrigger asChild className="hidden md:flex">
              <Button variant="outline" className="border-slate-200 dark:border-slate-700 dark:text-slate-300">
                <LayoutTemplate className="h-4 w-4 mr-2" /> Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-56">
              {templates.length === 0 ? (
                <DropdownMenuItem disabled className="text-slate-400 dark:text-slate-500">
                  No hay templates
                </DropdownMenuItem>
              ) : (
                templates.map((tmpl) => (
                  <DropdownMenuItem
                    key={tmpl.id}
                    onClick={() => applyTemplate(tmpl)}
                    className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{tmpl.title}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Crear Tarea</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Título</Label>
              <Input
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2" ref={assigneeDropdownRef}>
              <Label className="text-slate-700 dark:text-slate-300">Asignar usuario</Label>
              {projectMembers.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                    className="flex items-center justify-between w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <span className="truncate">
                      {assigneeIds.length === 0
                        ? "Seleccionar asignados..."
                        : assigneeIds.length === 1
                        ? getMemberName(assigneeIds[0])
                        : `${assigneeIds.length} asignados`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", assigneeDropdownOpen && "rotate-180")} />
                  </button>
                  {assigneeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assigneeIds.map(uid => (
                        <Badge key={uid} variant="secondary" className="gap-1 pr-1 border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700">
                          {getMemberName(uid)}
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleAssignee(uid); }} className="ml-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {assigneeDropdownOpen && (
                    <div className="relative z-50 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-60 overflow-y-auto">
                      {projectMembers.map((m) => (
                        <label key={m.user.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assigneeIds.includes(m.user.id)}
                            onChange={() => toggleAssignee(m.user.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
                            {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">{m.user.name || m.user.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Input
                  placeholder="Selecciona un proyecto primero"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              )}
            </div>
          </div>
          <div className="flex-shrink-0 pt-4">
            <Button onClick={handleCreate} className="w-full">
              Crear Tarea
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { resetForm(); setEditingTask(null); }}}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Título</Label>
              <Input
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Descripción</Label>
              <Input
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex-shrink-0 pt-4">
            <Button onClick={handleUpdate} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setDetailTask(null); setActiveTimer(null); setTimerSeconds(0); }}}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-slate-900 dark:text-slate-100">{detailTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 pt-4">
            {/* Description */}
            {detailTask?.description && (
              <div className="text-slate-600 dark:text-slate-400">{detailTask.description}</div>
            )}

            {/* Timer Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Timer
              </h3>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {activeTimer && activeTimer.taskId === detailTask?.id ? formatTimer(timerSeconds) : "00:00:00"}
                </div>
                {activeTimer && activeTimer.taskId === detailTask?.id ? (
                  <Button variant="destructive" size="sm" onClick={handleStopTimer}>
                    <Square className="h-4 w-4 mr-1" /> Detener
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => detailTask && handleStartTimer(detailTask.id)} disabled={!!activeTimer}>
                    <Play className="h-4 w-4 mr-1" /> Iniciar
                  </Button>
                )}
                {activeTimer && activeTimer.taskId !== detailTask?.id && (
                  <p className="text-xs text-orange-500 ml-2">Timer activo en otra tarea</p>
                )}
              </div>
              {totalTaskTime > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tiempo total registrado: {formatTimer(totalTaskTime)}
                </p>
              )}
              {timeEntries.filter((e) => detailTask && e.taskId === detailTask.id).length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {timeEntries.filter((e) => detailTask && e.taskId === detailTask.id).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{new Date(entry.startTime).toLocaleString()}</span>
                      <span>→</span>
                      <span>{entry.endTime ? new Date(entry.endTime).toLocaleTimeString() : "..."}</span>
                      <Badge variant="secondary" className="text-[10px] border dark:border-slate-600">{formatTimer(entry.duration || 0)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowSubtasks(!showSubtasks)}>
                <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSubtasks ? "" : "-rotate-90"}`} />
                  Subtareas ({subtasks.length})
                </h3>
                <Input
                  placeholder="Añadir subtarea..."
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  className="w-64 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubtask(); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {showSubtasks && (
                <div className="space-y-2 ml-4">
                  {subtasks.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No hay subtareas</p>
                  ) : (
                    subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <input
                          type="checkbox"
                          checked={st.status === "DONE"}
                          onChange={() => handleToggleSubtask(st)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                        <span className={cn("text-sm", st.status === "DONE" && "text-slate-400 line-through dark:text-slate-500")}>
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
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentarios ({comments.length})
              </h3>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
                        {c.author.name?.[0]?.toUpperCase() || c.author.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.author.name || c.author.email}</span>
                      <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{c.content}</p>
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <textarea
                    placeholder="Añadir comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 resize-none"
                  />
                  <Button size="sm" onClick={handleAddComment} className="self-end">Enviar</Button>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Archivos ({attachments.length})
              </h3>
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                    {a.type === "image" ? (
                      <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/attachments/${a.id}`}
                          alt={a.name}
                          className="h-10 w-10 rounded object-cover border border-slate-200 dark:border-slate-700"
                        />
                      </a>
                    ) : a.type === "pdf" ? (
                      <FileText className="h-5 w-5 text-red-500 shrink-0" />
                    ) : (
                      <File className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    )}
                    <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 dark:text-slate-300 hover:underline truncate min-w-0">
                      {a.name}
                    </a>
                    <span className="text-xs text-slate-400 shrink-0">{formatBytes(a.size)}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto shrink-0" onClick={() => handleDeleteAttachment(a.id)}>
                      <Trash2 className="h-3 w-3 text-slate-400" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" />
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
                <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300">{column.title}</h3>
                <span className="text-xs text-slate-400 ml-auto">{getTasksByStatus(column.id).length}</span>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 space-y-2 overflow-y-auto border border-slate-200 dark:border-slate-700">
                {getTasksByStatus(column.id).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Sin tareas</div>
                ) : (
                  getTasksByStatus(column.id).map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={() => handleOpenDetail(task)}
                      className="cursor-pointer hover:shadow-md transition-shadow bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm leading-tight text-slate-900 dark:text-slate-100">{task.title}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-700">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(task); }} className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {task.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {task.priority !== "NONE" && (
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 border", priorityColors[task.priority])}>
                              {priorityLabels[task.priority]}
                            </Badge>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        {(task.project?.name || getProjectName(task.projectId)) && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <FolderOpen className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400">{task.project?.name || getProjectName(task.projectId)}</span>
                          </div>
                        )}
                        {task.assignedTo && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <User className="h-3 w-3 text-blue-500" />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.assignedTo}</span>
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
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Tarea</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Estado</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Prioridad</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Fecha límite</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Proyecto</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Asignado</th>
                <th className="text-right p-3 text-sm font-medium text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">No hay tareas</td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => handleOpenDetail(task)}>
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
                        {task.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[300px]">{task.description}</p>}
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
                        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">{task.project?.name || getProjectName(task.projectId) || "-"}</td>
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">{task.assignedTo || "-"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(task); }} className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Pencil className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
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
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <CardContent className="py-12 text-center text-slate-500 dark:text-slate-400">No hay tareas</CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer" onClick={() => handleOpenDetail(task)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", columns.find(c => c.id === task.status)?.color)} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{task.title}</h3>
                        <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap">
                          <Badge variant="secondary" className={cn("text-[10px] border", statusColors[task.status])}>{statusLabels[task.status]}</Badge>
                          {task.priority !== "NONE" && (
                            <Badge variant="secondary" className={cn("text-[10px] border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                          )}
                          {task.dueDate && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {(task.project?.name || getProjectName(task.projectId)) && (
                            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">{task.project?.name || getProjectName(task.projectId)}</span>
                          )}
                          {task.assignedTo && (
                            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><User className="h-3 w-3" />{task.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Pencil className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
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
