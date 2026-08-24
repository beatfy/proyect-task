"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FolderOpen, Loader2, MoreHorizontal, Trash2, Copy, Building2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import { useOrganization } from "@/lib/organization-context";

interface LabelItem {
  id: string;
  name: string;
  color: string;
  _count?: { projects: number };
}

interface ProjectLabel {
  id: string;
  labelId: string;
  label: LabelItem;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  labels?: ProjectLabel[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { organizations, selectedOrg, setSelectedOrg, loading: orgLoading } = useOrganization();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      if (filterLabel !== "all") params.set("labelId", filterLabel);
      const response = await fetch(`/api/projects?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch {
      toast.error("Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, filterLabel]);

  const fetchLabels = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/labels?organizationId=${orgId}`);
      if (res.ok) setLabels(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedOrg && selectedOrg !== "all") {
      fetchProjects();
      fetchLabels(selectedOrg);
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [selectedOrg, fetchProjects, fetchLabels]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          color,
          organizationId: selectedOrg === "all" ? undefined : selectedOrg,
          labelIds: selectedLabels.length > 0 ? selectedLabels : undefined,
        }),
      });
      if (response.ok) {
        toast.success("Proyecto creado");
        setName("");
        setDescription("");
        setColor("#6366f1");
        setSelectedLabels([]);
        setOpen(false);
        fetchProjects();
      } else {
        toast.error("Error al crear proyecto");
      }
    } catch {
      toast.error("Error al crear proyecto");
    }
  };

  const handleDuplicate = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Proyecto duplicado");
        fetchProjects();
      } else {
        toast.error("Error al duplicar proyecto");
      }
    } catch {
      toast.error("Error al duplicar proyecto");
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Proyecto eliminado");
        setDeleteTarget(null);
        fetchProjects();
      } else {
        toast.error("Error al eliminar proyecto");
      }
    } catch {
      toast.error("Error al eliminar proyecto");
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  if (loading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Proyectos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Gestiona y organiza tus proyectos</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 font-medium">
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Organization + Label Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {organizations.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setFilterLabel("all"); }}>
              <SelectTrigger className="w-[240px] text-xs">
                <SelectValue placeholder="Selecciona agencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Agencias</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Label filter chips */}
        {labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => setFilterLabel("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                filterLabel === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
              }`}
            >
              Todos
            </button>
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => setFilterLabel(filterLabel === label.id ? "all" : label.id)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border"
                style={{
                  backgroundColor: filterLabel === label.id ? label.color : `${label.color}15`,
                  color: filterLabel === label.id ? "#fff" : label.color,
                  borderColor: filterLabel === label.id ? label.color : `${label.color}30`,
                }}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Crear Proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                placeholder="Nombre del proyecto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 cursor-pointer"
              />
            </div>
            {labels.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Etiquetas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
                      style={{
                        backgroundColor: selectedLabels.includes(label.id) ? label.color : `${label.color}15`,
                        color: selectedLabels.includes(label.id) ? "#fff" : label.color,
                        borderColor: selectedLabels.includes(label.id) ? label.color : `${label.color}30`,
                      }}
                    >
                      {label.name}
                      {selectedLabels.includes(label.id) && <X className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full">
              Crear Proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Eliminar Proyecto</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Eliminar este proyecto y todas sus tareas? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {projects.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No hay proyectos</h3>
            <p className="text-xs text-muted-foreground">Crea tu primer proyecto para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group bg-card hover:bg-card/80 border-border hover:border-primary/40 transition-all shadow-sm hover:shadow flex flex-col justify-between"
            >
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between">
                  <Link href={`/projects/${project.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {project.name}
                    </CardTitle>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 text-xs">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(project); }} className="gap-2 cursor-pointer">
                        <Copy className="h-3.5 w-3.5" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <Link href={`/projects/${project.id}`}>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {project.description || "Sin descripción"}
                  </p>
                  {project.labels && project.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.labels.map((pl) => (
                        <span
                          key={pl.id}
                          className="px-2 py-0.5 rounded text-[10px] font-medium border"
                          style={{
                            backgroundColor: `${pl.label.color}15`,
                            color: pl.label.color,
                            borderColor: `${pl.label.color}30`,
                          }}
                        >
                          {pl.label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
