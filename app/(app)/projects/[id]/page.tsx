"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Users, Trash2, MoreHorizontal, Pencil, Calendar, User, Loader2, Link2, Copy, Check, Mail, ChevronDown, X, Download, Clock, Tag, Upload, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface Assignee {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

interface Subtask {
  id: string;
  title: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  assignees?: Assignee[];
}

const columns = [
  { id: "TODO", title: "Por hacer", color: "bg-slate-500" },
  { id: "INPROGRESS", title: "En progreso", color: "bg-blue-500" },
  { id: "INREVIEW", title: "En revisión", color: "bg-yellow-500" },
  { id: "DONE", title: "Hecho", color: "bg-green-500" },
];

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  LOW: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
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

const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Admin",
  MEMBER: "Miembro",
};

const roleColors: Record<string, string> = {
  OWNER: "bg-neutral-100 dark:bg-neutral-900/10 text-neutral-900 dark:text-neutral-500 border-indigo-200 dark:border-indigo-800",
  ADMIN: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  MEMBER: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

// --- Kanban DnD Components ---

function CollapsibleSection({ title, badge, defaultOpen = false, children }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 mb-2 text-sm font-semibold text-[#172B4D] hover:text-[#0052CC]">
        <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        {title}
        {badge && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-[#6B778C]">{badge}</span>}
      </button>
      {open && <div className="pl-6">{children}</div>}
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="bg-card rounded-lg p-2 space-y-2 border border-border min-h-[100px]">{children}</div>;
}

function SortableTaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const taskAssignees = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assignee ? [task.assignee] : [];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn("bg-muted border-border hover:shadow-md cursor-pointer transition-shadow", isDragging && "shadow-lg ring-2 ring-neutral-500")}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm text-foreground">{task.title}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-500 cursor-pointer">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {task.description && <p className="text-xs text-muted-foreground mb-2">{task.description}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            {task.priority !== "NONE" && (
              <Badge variant="secondary" className={cn("text-xs border", priorityColors[task.priority])}>
                {priorityLabels[task.priority]}
              </Badge>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}
            {taskAssignees.map((a, i) => (
              <div key={a.id + i} className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]" title={a.name || a.email}>
                  {a.name?.[0]?.toUpperCase() || a.email[0].toUpperCase()}
                </div>
                <span className="text-xs text-muted-foreground">{a.name || a.email}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KanbanBoard({ tasks, setTasks, onTaskClick, handleDeleteTask, projectId }: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onTaskClick: (task: Task) => void;
  handleDeleteTask: (id: string) => void;
  projectId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getTasksByStatus = (s: string) => tasks.filter(t => t.status === s);

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: string, rollbackStatus: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        toast.success(`Tarea movida a ${statusLabels[newStatus] || newStatus}`);
      } else {
          // Revert optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: rollbackStatus } : t));
        toast.error("Error al mover tarea");
      }
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: rollbackStatus } : t));
      toast.error("Error de conexión");
    }
  }, [setTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setOriginalStatus(task.status);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Determine target column
    let targetStatus: string | null = null;

    // Dropped over a column container (id like "column-TODO")
    if (typeof over.id === "string" && over.id.startsWith("column-")) {
      targetStatus = over.id.replace("column-", "");
    } else {
      // Dropped over another task — find that task's column
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus && activeTask.status !== targetStatus) {
      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, status: targetStatus! } : t));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    let targetStatus: string | null = null;
    if (typeof over.id === "string" && over.id.startsWith("column-")) {
      targetStatus = over.id.replace("column-", "");
    } else {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus && originalStatus !== null && originalStatus !== targetStatus) {
      updateTaskStatus(activeTask.id, targetStatus, originalStatus);
    }
    setOriginalStatus(null);
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = getTasksByStatus(col.id);
          return (
            <div key={col.id} className="flex-1 min-w-[280px] max-w-[350px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={cn("w-3 h-3 rounded-full", col.color)} />
                <h3 className="font-medium text-sm text-foreground">{col.title}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
              </div>
              <DroppableColumn id={`column-${col.id}`}>
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Sin tareas</div>
                  ) : (
                    colTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => onTaskClick(task)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))
                  )}
                </SortableContext>
              </DroppableColumn>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <Card className="bg-muted border-border shadow-xl ring-2 ring-neutral-500 rotate-2">
            <CardContent className="p-3">
              <h4 className="font-medium text-sm text-foreground">{activeTask.title}</h4>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskOpen, setTaskOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<{id: string; name: string; url: string; createdAt: string}[]>([]);
  const [detailSubtasks, setDetailSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescText, setEditDescText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (detailTask) {
      fetch(`/api/attachments?taskId=${detailTask.id}`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? setDetailAttachments(d) : setDetailAttachments(d.attachments || [])).catch(() => setDetailAttachments([]));
      fetch(`/api/tasks?parentId=${detailTask.id}`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? setDetailSubtasks(d) : setDetailSubtasks([])).catch(() => setDetailSubtasks([]));
    } else {
      setDetailAttachments([]);
      setDetailSubtasks([]);
    }
  }, [detailTask?.id]);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("MEMBER");

  const [inviteLink, setInviteLink] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteExpires, setInviteExpires] = useState("7");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<{ token: string; url: string; expiresAt: string | null; maxUses: number | null; uses: number; role: string }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchMembers();
  }, [projectId]);

  // Close assignee dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) setProject(await res.json());
    } catch {}
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (res.ok) setTasks(await res.json());
    } catch {}
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  const resetTaskForm = () => {
    setTitle("");
    setDescription("");
    setStatus("TODO");
    setPriority("NONE");
    setDueDate("");
    setAssigneeIds([]);
    setEditTask(null);
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status,
          priority,
          dueDate: dueDate || null,
          projectId,
          assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
        }),
      });

      if (res.ok) {
        const task = await res.json();
        setTasks([...tasks, task]);
        resetTaskForm();
        setTaskOpen(false);
        toast.success("Tarea creada");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleEditTask = async () => {
    if (!editTask || !title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTask.id,
          title,
          description,
          status,
          priority,
          dueDate: dueDate || null,
          assigneeIds: assigneeIds.length > 0 ? assigneeIds : [],
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === editTask.id ? updated : t));
        resetTaskForm();
        setEditTask(null);
        setTaskOpen(false);
        toast.success("Tarea actualizada");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
        toast.success("Tarea eliminada");
      }
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const openEditTask = (task: Task) => {
    setEditTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    // Load multi-assignees
    const taskAssigneeIds = task.assignees?.map(a => a.id) || [];
    setAssigneeIds(taskAssigneeIds.length > 0 ? taskAssigneeIds : (task.assignee ? [task.assignee.id] : []));
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      toast.error("Email requerido");
      return;
    }

    try {
      // Usar endpoint de invitaciones que envía email con Resend
      const res = await fetch(`/api/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail, projectId, role: newMemberRole }),
      });

      if (res.ok) {
        const invitation = await res.json();
        setNewMemberEmail("");
        setNewMemberRole("MEMBER");
        setMemberOpen(false);
        toast.success(`Invitación enviada a ${newMemberEmail}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al enviar invitación");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("¿Eliminar este miembro?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMembers(members.filter(m => m.id !== memberId));
        toast.success("Miembro eliminado");
      }
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const getTasksByStatus = (s: string) => tasks.filter(t => t.status === s);

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.user.id === userId);
    return m ? (m.user.name || m.user.email) : userId;
  };

  const fetchInviteLinks = async () => {
    try {
      const res = await fetch(`/api/invitations/link?projectId=${projectId}`);
      if (res.ok) setInviteLinks(await res.json());
    } catch {}
  };

  const handleGenerateInviteLink = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invitations/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role: inviteRole,
          expiresDays: parseInt(inviteExpires) || 7,
          maxUses: inviteMaxUses ? parseInt(inviteMaxUses) : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteLink(data.url);
        fetchInviteLinks();
        toast.success("Link generado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al generar link");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyToClipboard = async (text: string, idx?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (idx !== undefined) {
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      toast.success("Link copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: project?.color }} />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{project?.name}</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { fetchInviteLinks(); setInviteOpen(true); }}>
            <Link2 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Invitar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMemberOpen(true)}>
            <Users className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Miembros</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <DropdownMenuItem onClick={() => window.open(`/api/tasks/export?projectId=${projectId}&format=csv`)} className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/tasks/export?projectId=${projectId}&format=pdf`)} className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => { resetTaskForm(); setTaskOpen(true); }}>
            <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nueva Tarea</span>
          </Button>
        </div>
      </div>

      {/* Description */}
      {project?.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {/* Members quick view */}
      {members.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Miembros ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted">
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                    {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-foreground">{m.user.name || m.user.email}</span>
                  <Badge variant="secondary" className={cn("text-xs border", roleColors[m.role])}>
                    {roleLabels[m.role]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban */}
      <KanbanBoard
        tasks={tasks}
        setTasks={setTasks}
        onTaskClick={(task) => { setDetailTask(task); setDetailOpen(true); }}
        handleDeleteTask={handleDeleteTask}
        projectId={projectId}
      />

      {/* Task Detail Dialog - Jira Style */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setDetailTask(null); setDetailAttachments([]); } }}>
        <DialogContent className="bg-card border-border p-0 gap-0 overflow-hidden w-[95vw] md:w-[85vw] max-w-[95vw] md:max-w-[85vw] h-[90vh] md:h-[85vh] max-h-[90vh] md:max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE1E6]">
            <DialogTitle className="text-xl font-bold text-[#172B4D]">{detailTask?.title}</DialogTitle>

          </div>
          {/* Two columns */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ height: "calc(85vh - 65px)" }}>
            {/* Left column 70% */}
            <div className="flex-1 md:flex-[7] overflow-y-auto p-4 md:p-6 space-y-5">
              {/* Descripción editable */}
              <CollapsibleSection title="Descripción" defaultOpen>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDescText}
                      onChange={(e) => setEditDescText(e.target.value)}
                      className="w-full min-h-[100px] text-sm text-[#172B4D] bg-white border border-[#DFE1E6] rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 resize-y"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-[#0052CC] hover:bg-[#0052CC]/90" onClick={async () => {
                        if (!detailTask) return;
                        await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, description: editDescText }) });
                        setDetailTask({ ...detailTask, description: editDescText });
                        setEditingDescription(false);
                        toast.success("Descripción guardada");
                      }}>Guardar</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDescription(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => { setEditDescText(detailTask?.description || ""); setEditingDescription(true); }}
                    className="cursor-pointer rounded-md p-3 border border-[#DFE1E6] hover:bg-muted/60 transition-colors min-h-[60px]"
                  >
                    {detailTask?.description ? (
                      <p className="text-sm text-[#172B4D] whitespace-pre-wrap">{detailTask.description}</p>
                    ) : (
                      <p className="text-sm text-[#6B778C] italic">Haz clic para añadir una descripción...</p>
                    )}
                  </div>
                )}
              </CollapsibleSection>

              {/* Archivos adjuntos con upload */}
              <CollapsibleSection title="Archivos adjuntos" badge={detailAttachments.length > 0 ? String(detailAttachments.length) : undefined} defaultOpen={detailAttachments.length > 0}>
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !detailTask) return;
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("taskId", detailTask.id);
                        const res = await fetch("/api/attachments", { method: "POST", body: formData });
                        if (res.ok) {
                          const att = await res.json();
                          setDetailAttachments(prev => [att, ...prev]);
                          toast.success("Archivo subido");
                        } else {
                          const data = await res.json();
                          toast.error(data.error || "Error al subir");
                        }
                      } catch { toast.error("Error de conexión"); }
                      finally { setUploading(false); e.target.value = ""; }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[#6B778C] border-[#DFE1E6] hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Subiendo..." : "Subir archivo"}
                  </Button>
                  {detailAttachments.length === 0 ? (
                    !uploading && <p className="text-sm text-[#6B778C] italic">Sin archivos adjuntos</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {detailAttachments.map((att) => {
                        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.name);
                        return (
                          <div key={att.id} className="relative group rounded-lg border border-[#DFE1E6] overflow-hidden hover:shadow-md transition-shadow">
                            <a href={`/api/attachments/${att.id}`} target="_blank" rel="noopener noreferrer" className="block">
                              {isImage ? (
                                <img src={`/api/attachments/${att.id}`} alt={att.name} className="w-full h-24 object-cover" />
                              ) : (
                                <div className="w-full h-24 flex flex-col items-center justify-center bg-muted/50 gap-1"><Download className="h-8 w-8 text-[#6B778C]" /><span className="text-[10px] text-[#6B778C]">Descargar</span></div>
                              )}
                              <div className="p-2">
                                <p className="text-xs text-[#172B4D] truncate">{att.name}</p>
                                <p className="text-[10px] text-[#6B778C]">{new Date(att.createdAt).toLocaleDateString("es-ES")}</p>
                              </div>
                            </a>
                            <button
                              onClick={async () => {
                                if (!confirm("¿Eliminar este archivo?")) return;
                                const res = await fetch(`/api/attachments?id=${att.id}`, { method: "DELETE" });
                                if (res.ok) {
                                  setDetailAttachments(prev => prev.filter(a => a.id !== att.id));
                                  toast.success("Archivo eliminado");
                                }
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Subtareas funcionales */}
              <CollapsibleSection title="Subtareas" badge={detailSubtasks.length > 0 ? String(detailSubtasks.length) : undefined} defaultOpen>
                <div className="space-y-2">
                  {detailSubtasks.map((st) => (
                    <div key={st.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={st.status === "DONE"}
                        onChange={async () => {
                          const newStatus = st.status === "DONE" ? "TODO" : "DONE";
                          await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: st.id, status: newStatus }) });
                          setDetailSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: newStatus } : s));
                        }}
                        className="rounded border-[#DFE1E6] text-[#0052CC] focus:ring-[#0052CC]/30"
                      />
                      <span className={cn("text-sm flex-1", st.status === "DONE" && "line-through text-[#6B778C]")}>{st.title}</span>
                      <button
                        onClick={async () => {
                          await fetch(`/api/tasks?id=${st.id}`, { method: "DELETE" });
                          setDetailSubtasks(prev => prev.filter(s => s.id !== st.id));
                          toast.success("Subtarea eliminada");
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Añadir subtarea..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newSubtaskTitle.trim() && detailTask) {
                          const res = await fetch("/api/tasks", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: newSubtaskTitle.trim(), parentId: detailTask.id, projectId, status: "TODO" }),
                          });
                          if (res.ok) {
                            const st = await res.json();
                            setDetailSubtasks(prev => [...prev, { id: st.id, title: st.title, status: st.status }]);
                            setNewSubtaskTitle("");
                          }
                        }
                      }}
                      className="flex-1 text-sm border border-[#DFE1E6] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-[#0052CC] hover:bg-[#0052CC]/90"
                      onClick={async () => {
                        if (!newSubtaskTitle.trim() || !detailTask) return;
                        const res = await fetch("/api/tasks", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: newSubtaskTitle.trim(), parentId: detailTask.id, projectId, status: "TODO" }),
                        });
                        if (res.ok) {
                          const st = await res.json();
                          setDetailSubtasks(prev => [...prev, { id: st.id, title: st.title, status: st.status }]);
                          setNewSubtaskTitle("");
                          toast.success("Subtarea creada");
                        }
                      }}
                    >Añadir</Button>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Right sidebar 30% */}
            <div className="flex-[3] bg-[#F4F5F7] border-l-0 md:border-l border-t md:border-t-0 border-[#DFE1E6] p-4 md:p-5 space-y-5 overflow-y-auto">
              {/* Status pill */}
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white bg-[#0052CC] hover:bg-[#0052CC]/90 transition">
                      {statusLabels[detailTask?.status || ""] || detailTask?.status}
                      <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {["TODO", "INPROGRESS", "INREVIEW", "DONE"].map(s => (
                      <DropdownMenuItem key={s} onClick={async () => {
                        if (!detailTask) return;
                        await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, status: s }) });
                        setDetailTask({ ...detailTask, status: s as Task["status"] });
                        setTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, status: s as Task["status"] } : t));
                        toast.success(`Estado cambiado a ${statusLabels[s]}`);
                      }}>{statusLabels[s]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Detalles */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6B778C]">Detalles</h4>

                {/* Persona asignada */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Persona asignada</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 text-sm text-[#172B4D] hover:bg-white/60 rounded px-1 py-0.5 -ml-1">
                        {(() => {
                          const a = detailTask?.assignees?.[0] || detailTask?.assignee;
                          if (!a) return <span className="text-[#6B778C]">Ninguno</span>;
                          return <>
                            <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs shrink-0">{(a.name || a.email)[0].toUpperCase()}</div>
                            <span>{a.name || a.email}</span>
                          </>;
                        })()}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={async () => {
                        if (!detailTask) return;
                        await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, assigneeIds: [] }) });
                        setDetailTask({ ...detailTask, assignees: [], assignee: undefined as any });
                        toast.success("Asignado eliminado");
                      }}>Ninguno</DropdownMenuItem>
                      {members.map(m => (
                        <DropdownMenuItem key={m.user.id} onClick={async () => {
                          if (!detailTask) return;
                          await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, assigneeIds: [m.user.id] }) });
                          const newAssignee = { id: m.user.id, name: m.user.name, email: m.user.email };
                          setDetailTask({ ...detailTask, assignees: [newAssignee], assignee: newAssignee as any });
                          toast.success(`Asignado a ${m.user.name || m.user.email}`);
                        }}>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">{(m.user.name || m.user.email)[0].toUpperCase()}</div>
                            {m.user.name || m.user.email}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Informador (Creador) */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Informador</p>
                  <div className="flex items-center gap-2 text-sm text-[#172B4D]">
                    <span className="text-[#6B778C]">—</span>
                  </div>
                </div>

                {/* Prioridad */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Prioridad</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 text-sm text-[#172B4D] hover:bg-white/60 rounded px-1 py-0.5 -ml-1">
                        {detailTask?.priority === "HIGH" && <span className="text-red-500">▲</span>}
                        {detailTask?.priority === "MEDIUM" && <span className="text-yellow-500">▲</span>}
                        {detailTask?.priority === "LOW" && <span className="text-blue-400">▼</span>}
                        {detailTask?.priority === "NONE" && <span className="text-[#6B778C]">—</span>}
                        <span>{priorityLabels[detailTask?.priority || "NONE"]}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {["NONE", "LOW", "MEDIUM", "HIGH"].map(p => (
                        <DropdownMenuItem key={p} onClick={async () => {
                          if (!detailTask) return;
                          await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, priority: p }) });
                          setDetailTask({ ...detailTask, priority: p as Task["priority"] });
                          toast.success(`Prioridad cambiada a ${priorityLabels[p]}`);
                        }}>{priorityLabels[p]}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Etiquetas */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Etiquetas</p>
                  <p className="text-sm text-[#172B4D]">Ninguno</p>
                </div>

                {/* Fecha de vencimiento */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Fecha de vencimiento</p>
                  <input
                    type="date"
                    value={detailTask?.dueDate ? new Date(detailTask.dueDate).toISOString().split("T")[0] : ""}
                    onChange={async (e) => {
                      if (!detailTask) return;
                      const val = e.target.value || null;
                      await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detailTask.id, dueDate: val }) });
                      setDetailTask({ ...detailTask, dueDate: val });
                      toast.success("Fecha de vencimiento actualizada");
                    }}
                    className="text-sm text-[#172B4D] bg-transparent border-none outline-none cursor-pointer"
                  />
                </div>

                {/* Fecha inicio */}
                <div>
                  <p className="text-[11px] text-[#6B778C] mb-1">Fecha inicio</p>
                  <p className="text-sm text-[#6B778C]">Ninguno</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-[#DFE1E6] space-y-2">
                <Button
                  className="w-full gap-2 bg-[#0052CC] hover:bg-[#0052CC]/90 text-white"
                  onClick={() => {
                    if (detailTask) {
                      openEditTask(detailTask);
                      setTaskOpen(true);
                      setDetailOpen(false);
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" /> Editar tarea
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => {
                    if (detailTask) {
                      handleDeleteTask(detailTask.id);
                      setDetailOpen(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={(v) => { setTaskOpen(v); if (!v) resetTaskForm(); }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">
              {editTask ? "Editar Tarea" : "Crear Tarea"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Título</Label>
              <Input
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Descripción</Label>
              <Input
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Fecha límite</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            {/* Multi-assignee dropdown */}
            <div className="space-y-2 relative" ref={assigneeDropdownRef}>
              <Label className="text-foreground">Asignar a</Label>
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                className="flex items-center justify-between w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent"
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

              {/* Selected assignees as badges */}
              {assigneeIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {assigneeIds.map(uid => (
                    <Badge key={uid} variant="secondary" className="gap-1 pr-1 border bg-neutral-50 dark:bg-neutral-900/10 text-neutral-800 dark:text-neutral-400 border-indigo-200 dark:border-neutral-800">
                      {getMemberName(uid)}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleAssignee(uid); }}
                        className="ml-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {assigneeDropdownOpen && (
                <div className="relative z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
                  {members.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No hay miembros en el proyecto</div>
                  ) : (
                    members.map((m) => (
                      <label
                        key={m.user.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(m.user.id)}
                          onChange={() => toggleAssignee(m.user.id)}
                          className="rounded border-gray-300 text-neutral-900 focus:ring-neutral-900"
                        />
                        <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                          {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{m.user.name || m.user.email}</p>
                        </div>
                        <Badge variant="secondary" className={cn("text-xs border", roleColors[m.role])}>
                          {roleLabels[m.role]}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <Button onClick={editTask ? handleEditTask : handleCreateTask} className="w-full">
              {editTask ? "Guardar" : "Crear Tarea"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (v) fetchInviteLinks(); else setInviteLink(""); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Link2 className="h-5 w-5 text-neutral-900" /> Invitar con Link
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-5 pt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Genera un link único para invitar gente a este proyecto. Cualquiera con el link podrá unirse tras registrarse.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rol</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-card border-border text-foreground h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="MEMBER">Miembro</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expira en</Label>
                  <Select value={inviteExpires} onValueChange={setInviteExpires}>
                    <SelectTrigger className="bg-card border-border text-foreground h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="1">1 día</SelectItem>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="0">Nunca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Usos máx.</Label>
                  <Input
                    placeholder="∞"
                    value={inviteMaxUses}
                    onChange={(e) => setInviteMaxUses(e.target.value)}
                    className="bg-card border-border text-foreground h-9 text-sm"
                    type="number"
                    min="1"
                  />
                </div>
              </div>

              <Button onClick={handleGenerateInviteLink} disabled={inviteLoading} className="w-full">
                {inviteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Generar Link de Invitación
              </Button>
            </div>

            {inviteLink && (
              <div className="bg-neutral-900/10 border border-neutral-400 dark:border-neutral-800 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-neutral-800">✅ Link generado — compártelo:</p>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="bg-card border-neutral-400 dark:border-neutral-800 text-foreground text-sm font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(inviteLink)} className="shrink-0 border-neutral-400">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {inviteLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Links activos</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inviteLinks.map((link, idx) => (
                    <div key={link.token} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate font-mono">{link.url}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs border bg-card">{roleLabels[link.role] || link.role}</Badge>
                          {link.maxUses && (
                            <span className="text-xs text-muted-foreground">{link.uses}/{link.maxUses} usos</span>
                          )}
                          {link.expiresAt && (
                            <span className="text-xs text-muted-foreground">Expira {new Date(link.expiresAt).toLocaleDateString()}</span>
                          )}
                          {!link.expiresAt && (
                            <span className="text-xs text-green-500">Sin expiración</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(link.url, idx)}>
                        {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Miembros del Proyecto</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Email del usuario"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="bg-card border-border text-foreground"
              />
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="w-[120px] bg-card border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="MEMBER">Miembro</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember}>Añadir</Button>
            </div>

            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No hay miembros</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm">
                        {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{m.user.name || m.user.email}</p>
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                      <Badge variant="secondary" className={cn("text-xs border", roleColors[m.role])}>
                        {roleLabels[m.role]}
                      </Badge>
                    </div>
                    {m.role !== "OWNER" && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id)} className="h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
