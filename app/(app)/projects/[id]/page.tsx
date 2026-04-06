"use client";

import { use, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Users, Trash2, MoreHorizontal, Pencil, Calendar, User, Loader2, Link2, Copy, Check, Mail, ChevronDown, X } from "lucide-react";
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
  OWNER: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  ADMIN: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  MEMBER: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskOpen, setTaskOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
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
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
      });

      if (res.ok) {
        const member = await res.json();
        setMembers([...members, member]);
        setNewMemberEmail("");
        setNewMemberRole("MEMBER");
        setMemberOpen(false);
        toast.success("Miembro añadido");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al añadir");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project?.color }} />
          <h1 className="text-3xl font-bold text-foreground">{project?.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchInviteLinks(); setInviteOpen(true); }}>
            <Link2 className="h-4 w-4 mr-2" /> Invitar con link
          </Button>
          <Button variant="outline" onClick={() => setMemberOpen(true)}>
            <Users className="h-4 w-4 mr-2" /> Miembros
          </Button>
          <Button onClick={() => { resetTaskForm(); setTaskOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
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
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="flex-1 min-w-[280px] max-w-[350px]">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={cn("w-3 h-3 rounded-full", col.color)} />
              <h3 className="font-medium text-sm text-foreground">{col.title}</h3>
              <span className="text-xs text-muted-foreground ml-auto">{getTasksByStatus(col.id).length}</span>
            </div>
            <div className="bg-card rounded-lg p-2 space-y-2 border border-border">
              {getTasksByStatus(col.id).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Sin tareas</div>
              ) : (
                getTasksByStatus(col.id).map((task) => {
                  const taskAssignees = task.assignees && task.assignees.length > 0
                    ? task.assignees
                    : task.assignee ? [task.assignee] : [];

                  return (
                    <Card key={task.id} className="bg-muted border-border hover:shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm text-foreground">{task.title}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              <DropdownMenuItem onClick={() => { openEditTask(task); setTaskOpen(true); }} className="cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-500 cursor-pointer">
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
                              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]" title={a.name || a.email}>
                                {a.name?.[0]?.toUpperCase() || a.email[0].toUpperCase()}
                              </div>
                              <span className="text-xs text-muted-foreground">{a.name || a.email}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={(v) => { setTaskOpen(v); if (!v) resetTaskForm(); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTask ? "Editar Tarea" : "Crear Tarea"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
            <div className="grid grid-cols-2 gap-4">
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
                    <Badge key={uid} variant="secondary" className="gap-1 pr-1 border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700">
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
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
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
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-500" /> Invitar con Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Genera un link único para invitar gente a este proyecto. Cualquiera con el link podrá unirse tras registrarse.</p>
              
              <div className="grid grid-cols-3 gap-3">
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
              <div className="bg-indigo-500/10 border border-indigo-300 dark:border-indigo-700 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-indigo-700">✅ Link generado — compártelo:</p>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="bg-card border-indigo-300 dark:border-indigo-700 text-foreground text-sm font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(inviteLink)} className="shrink-0 border-indigo-300">
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
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Miembros del Proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm">
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
