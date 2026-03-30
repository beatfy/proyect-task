"use client";

import { use, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Plus, Users, Trash2, MoreHorizontal, Pencil, Calendar, User, Loader2, Link2, Copy, Check, Mail } from "lucide-react";
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

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
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

const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Admin",
  MEMBER: "Miembro",
};

const roleColors: Record<string, string> = {
  OWNER: "bg-indigo-100 text-indigo-600 border-indigo-200",
  ADMIN: "bg-blue-100 text-blue-600 border-blue-200",
  MEMBER: "bg-gray-100 text-gray-600 border-gray-200",
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
  const [assigneeId, setAssigneeId] = useState("");

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
    setAssigneeId("");
    setEditTask(null);
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
          assigneeId: assigneeId || null,
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
          assigneeId: assigneeId || null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === editTask.id ? updated : t));
        resetTaskForm();
        setEditTask(null);
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
    setAssigneeId(task.assignee?.id || "");
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project?.color }} />
          <h1 className="text-3xl font-bold text-slate-900">{project?.name}</h1>
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
        <p className="text-slate-500">{project.description}</p>
      )}

      {/* Members quick view */}
      {members.length > 0 && (
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Miembros ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-100">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
                    {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700">{m.user.name || m.user.email}</span>
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
              <h3 className="font-medium text-sm text-slate-700">{col.title}</h3>
              <span className="text-xs text-slate-400 ml-auto">{getTasksByStatus(col.id).length}</span>
            </div>
            <div className="bg-white rounded-lg p-2 space-y-2 border border-slate-200">
              {getTasksByStatus(col.id).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Sin tareas</div>
              ) : (
                getTasksByStatus(col.id).map((task) => (
                  <Card key={task.id} className="bg-slate-50 border-slate-200 hover:shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm text-slate-900">{task.title}</h4>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-slate-200">
                            <DropdownMenuItem onClick={() => { openEditTask(task); setTaskOpen(true); }} className="cursor-pointer">
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-500 cursor-pointer">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {task.description && <p className="text-xs text-slate-500 mb-2">{task.description}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.priority !== "NONE" && (
                          <Badge variant="secondary" className={cn("text-xs border", priorityColors[task.priority])}>
                            {priorityLabels[task.priority]}
                          </Badge>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {task.assignee && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <User className="h-3 w-3" />
                            {task.assignee.name || task.assignee.email}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={(v) => { setTaskOpen(v); if (!v) resetTaskForm(); }}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {editTask ? "Editar Tarea" : "Crear Tarea"}
            </DialogTitle>
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
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
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
              <Label className="text-slate-700">Fecha límite</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Asignar a</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="">Sin asignar</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name || m.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={editTask ? handleEditTask : handleCreateTask} className="w-full">
              {editTask ? "Guardar" : "Crear Tarea"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (v) fetchInviteLinks(); else setInviteLink(""); }}>
        <DialogContent className="bg-white border-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-500" /> Invitar con Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            {/* Generate new link */}
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Genera un link único para invitar gente a este proyecto. Cualquiera con el link podrá unirse tras registrarse.</p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Rol</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-white border-slate-300 text-slate-900 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="MEMBER">Miembro</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Expira en</Label>
                  <Select value={inviteExpires} onValueChange={setInviteExpires}>
                    <SelectTrigger className="bg-white border-slate-300 text-slate-900 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="1">1 día</SelectItem>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="0">Nunca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Usos máx.</Label>
                  <Input
                    placeholder="∞"
                    value={inviteMaxUses}
                    onChange={(e) => setInviteMaxUses(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 h-9 text-sm"
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

            {/* Generated link */}
            {inviteLink && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-indigo-700">✅ Link generado — compártelo:</p>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="bg-white border-indigo-200 text-slate-900 text-sm font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(inviteLink)} className="shrink-0 border-indigo-200">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Existing links */}
            {inviteLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Links activos</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inviteLinks.map((link, idx) => (
                    <div key={link.token} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 truncate font-mono">{link.url}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs border bg-white">{roleLabels[link.role] || link.role}</Badge>
                          {link.maxUses && (
                            <span className="text-xs text-slate-400">{link.uses}/{link.maxUses} usos</span>
                          )}
                          {link.expiresAt && (
                            <span className="text-xs text-slate-400">Expira {new Date(link.expiresAt).toLocaleDateString()}</span>
                          )}
                          {!link.expiresAt && (
                            <span className="text-xs text-green-500">Sin expiración</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(link.url, idx)}>
                        {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
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
        <DialogContent className="bg-white border-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Miembros del Proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Add member */}
            <div className="flex gap-2">
              <Input
                placeholder="Email del usuario"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="bg-white border-slate-300 text-slate-900"
              />
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="w-[120px] bg-white border-slate-300 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="MEMBER">Miembro</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember}>Añadir</Button>
            </div>

            {/* Members list */}
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No hay miembros</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm">
                        {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{m.user.name || m.user.email}</p>
                        <p className="text-xs text-slate-500">{m.user.email}</p>
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