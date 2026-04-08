"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2, Plus, Users, FolderOpen, Settings, Trash2,
  Loader2, ArrowLeft, MoreHorizontal, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count?: { members: number; projects: number };
}

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
  joinedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  _count?: { tasks: number };
}

const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
};

const roleColors: Record<string, string> = {
  OWNER: "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/10 dark:text-neutral-400",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  MEMBER: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"projects" | "members">("projects");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectColor, setProjectColor] = useState("#6366f1");
  const [creatingProject, setCreatingProject] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);

  useEffect(() => {
    fetchOrg();
    fetchMembers();
    fetchProjects();
  }, [orgId]);

  const fetchOrg = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOrg(data);
        setEditName(data.name);
        setEditDesc(data.description || "");
      } else {
        toast.error("Organización no encontrada");
        router.push("/organizations");
      }
    } catch {
      toast.error("Error al cargar organización");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {}
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/projects`);
      if (res.ok) setProjects(await res.json());
    } catch {}
  };

  const handleEditOrg = async () => {
    if (!editName.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrg(updated);
        setEditOpen(false);
        toast.success("Organización actualizada");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!confirm("¿Eliminar esta organización y todos sus proyectos? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Organización eliminada");
        router.push("/organizations");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) { toast.error("El nombre es requerido"); return; }
    setCreatingProject(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim(), description: projectDesc.trim() || null, color: projectColor }),
      });
      if (res.ok) {
        toast.success("Proyecto creado");
        setProjectName("");
        setProjectDesc("");
        setProjectColor("#6366f1");
        setProjectOpen(false);
        fetchProjects();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear proyecto");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("¿Eliminar este miembro de la organización?")) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMembers(members.filter((m) => m.id !== memberId));
        toast.success("Miembro eliminado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) { toast.error("El email es requerido"); return; }
    setInviting(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pendingInvite) {
          toast.success(data.message);
          if (data.inviteUrl) {
            // No email service — show link to copy
            try {
              await navigator.clipboard.writeText(data.inviteUrl);
              toast.success("Enlace de invitación copiado al portapapeles");
            } catch {
              prompt("Comparte este enlace:", data.inviteUrl);
            }
          }
        } else {
          setMembers([...members, data]);
          toast.success("Miembro añadido");
        }
        setInviteEmail("");
        setInviteRole("MEMBER");
        setInviteMemberOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al añadir miembro");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/organizations")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-900/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-neutral-900 dark:text-neutral-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{org.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {org.slug}
              {org.description && ` · ${org.description}`}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteOrg} className="text-red-500 cursor-pointer">
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-neutral-900" />
            <div>
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
              <p className="text-sm text-muted-foreground">Miembros</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 pt-6">
            <FolderOpen className="h-8 w-8 text-neutral-900" />
            <div>
              <p className="text-2xl font-bold text-foreground">{projects.length}</p>
              <p className="text-sm text-muted-foreground">Proyectos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "projects" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("projects")}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Proyectos
        </Button>
        <Button
          variant={activeTab === "members" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("members")}
        >
          <Users className="h-4 w-4 mr-2" />
          Miembros
        </Button>
      </div>

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Proyectos</h2>
            <Button onClick={() => setProjectOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Nuevo proyecto
            </Button>
          </div>

          {projects.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center py-12">
                <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay proyectos en esta organización</p>
                <Button variant="outline" className="mt-3" onClick={() => setProjectOpen(true)}>
                  Crear primer proyecto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="bg-card border-border hover:border-neutral-900/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                        <CardTitle className="text-sm text-foreground">{project.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mb-2">{project.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {project._count?.tasks || 0} tareas
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Miembros</h2>
            <Button onClick={() => setInviteMemberOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Añadir miembro
            </Button>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Sin miembros</div>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-medium">
                          {(member.user.name || member.user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {member.user.name || member.user.email}
                          </p>
                          {member.user.name && (
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors[member.role] || roleColors.MEMBER}>
                          {roleLabels[member.role] || member.role}
                        </Badge>
                        {member.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Org Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Editar organización</DialogTitle>
            <DialogDescription>Modifica el nombre o descripción</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Descripción</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-card border-border text-foreground"
                rows={3}
              />
            </div>
            <Button onClick={handleEditOrg} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Nuevo proyecto</DialogTitle>
            <DialogDescription>Crea un proyecto dentro de esta organización</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nombre</Label>
              <Input
                placeholder="Nombre del proyecto"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Descripción</Label>
              <Textarea
                placeholder="Descripción (opcional)"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="bg-card border-border text-foreground"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Color</Label>
              <div className="flex gap-2">
                {["#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"].map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      projectColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setProjectColor(c)}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateProject} disabled={creatingProject} className="w-full">
              {creatingProject ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Crear proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteMemberOpen} onOpenChange={setInviteMemberOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Añadir miembro</DialogTitle>
            <DialogDescription>Invita por email a un usuario registrado</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Email</Label>
              <Input
                placeholder="email@ejemplo.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Rol</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
              >
                <option value="MEMBER">Miembro</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <Button onClick={handleInviteMember} disabled={inviting} className="w-full">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Añadir miembro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
