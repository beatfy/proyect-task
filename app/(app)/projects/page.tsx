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


const PRESET_LABELS = [
  { name: "Campaña SEO", color: "#C75B39" },
  { name: "Campaña SEM", color: "#2E5C8A" },
  { name: "Gestión Redes", color: "#D4A373" },
  { name: "Rediseño Web", color: "#52796F" },
  { name: "Branding", color: "#8B5CF6" },
  { name: "Consultoría", color: "#EC4899" },
  { name: "Mantenimiento", color: "#10B981" },
];

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
      toast.error("Error al cargar clientes");
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
          organizationId: selectedOrg,
          labelIds: selectedLabels.length > 0 ? selectedLabels : undefined,
        }),
      });
      if (response.ok) {
        const project = await response.json();
        setProjects([...projects, project]);
        setName("");
        setDescription("");
        setSelectedLabels([]);
        setOpen(false);
        toast.success("Cliente creado");
      }
    } catch {
      toast.error("Error al crear cliente");
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== project.id));
        setDeleteTarget(null);
        toast.success("Cliente eliminado");
      } else {
        const data = await response.json();
        toast.error(data.error || "Error al eliminar cliente");
      }
    } catch {
      toast.error("Error al eliminar cliente");
    }
  };

  const handleDuplicate = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "POST" });
      if (response.ok) {
        const duplicated = await response.json();
        setProjects([...projects, duplicated]);
        toast.success(`Cliente duplicado como "${duplicated.name}"`);
      } else {
        const data = await response.json();
        toast.error(data.error || "Error al duplicar cliente");
      }
    } catch {
      toast.error("Error al duplicar cliente");
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Clientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona tus clientes y proyectos de marketing</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Organization + Label Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {organizations.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setFilterLabel("all"); }}>
              <SelectTrigger className="w-[280px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                <SelectValue placeholder="Selecciona agencia" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <SelectItem value="all" className="text-slate-900 dark:text-slate-100">Todas</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id} className="text-slate-900 dark:text-slate-100">
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
            <Tag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <button
              onClick={() => setFilterLabel("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterLabel === "all"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              Todos
            </button>
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => setFilterLabel(filterLabel === label.id ? "all" : label.id)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: filterLabel === label.id ? label.color : `${label.color}20`,
                  color: filterLabel === label.id ? "#fff" : label.color,
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
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Crear Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Nombre</Label>
              <Input
                placeholder="Nombre del cliente"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              <Label className="text-slate-700 dark:text-slate-300">Color</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 h-10"
              />
            </div>
            {labels.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Etiquetas</Label>
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        backgroundColor: selectedLabels.includes(label.id) ? label.color : `${label.color}20`,
                        color: selectedLabels.includes(label.id) ? "#fff" : label.color,
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
              Crear Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Eliminar Cliente</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              ¿Eliminar este cliente y todas sus tareas? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {projects.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-slate-400 dark:text-slate-500 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No hay clientes</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Crea tu primer cliente para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Link href={`/projects/${project.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100 truncate">{project.name}</CardTitle>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-slate-500"
                        onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(project); }}
                        className="text-slate-700 dark:text-slate-300">
                        <Copy className="h-4 w-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}
                        className="text-red-600 dark:text-red-400">
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <Link href={`/projects/${project.id}`}>
                <CardContent>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                    {project.description || "Sin descripción"}
                  </p>
                  {project.labels && project.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.labels.map((pl) => (
                        <span
                          key={pl.id}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: `${pl.label.color}20`, color: pl.label.color }}
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
