"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate, Plus, Trash2, Edit3, Copy, X, Check, Loader2,
  Bug, Lightbulb, Eye, FileText, Rocket, TestTube, Palette, Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[] | null;
  isDefault: boolean;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  URGENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const templateIcons: Record<string, typeof LayoutTemplate> = {
  "Bug fix": Bug,
  "Feature": Lightbulb,
  "Review": Eye,
};

function getTemplateIcon(name: string) {
  for (const [key, icon] of Object.entries(templateIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return LayoutTemplate;
}

export default function TemplatesPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState("TODO");
  const [priority, setPriority] = useState("NONE");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {
      toast.error("Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setTitle("");
    setDescription("");
    setTaskStatus("TODO");
    setPriority("NONE");
    setTagsInput("");
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (t: TaskTemplate) => {
    setEditId(t.id);
    setName(t.name);
    setTitle(t.title);
    setDescription(t.description || "");
    setTaskStatus(t.status);
    setPriority(t.priority);
    setTagsInput(t.tags?.join(", ") || "");
    setDialogOpen(true);
  };

  const duplicate = async (t: TaskTemplate) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${t.name} (copia)`,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          tags: t.tags,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates([...templates, created]);
        toast.success("Plantilla duplicada");
      }
    } catch {
      toast.error("Error al duplicar");
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !title.trim()) {
      toast.error("Nombre y título son requeridos");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      // For now, templates API only supports POST (create) and DELETE.
      // Editing a custom template = delete + recreate
      if (editId && !templates.find((t) => t.id === editId)?.isDefault) {
        await fetch(`/api/templates?id=${editId}`, { method: "DELETE" });
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          description: description || null,
          status: taskStatus,
          priority,
          tags: tags.length > 0 ? tags : null,
        }),
      });

      if (res.ok) {
        toast.success(editId ? "Plantilla actualizada" : "Plantilla creada");
        setDialogOpen(false);
        resetForm();
        fetchTemplates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== id));
        toast.success("Plantilla eliminada");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const defaults = templates.filter((t) => t.isDefault);
  const custom = templates.filter((t) => !t.isDefault);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-indigo-500" />
            Plantillas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crea plantillas para generar tareas rápidamente con formato predefinido
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Plantilla
        </Button>
      </div>

      {/* Default templates */}
      {defaults.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Plantillas predeterminadas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {defaults.map((t) => {
              const Icon = getTemplateIcon(t.name);
              return (
                <Card key={t.id} className="bg-card border-border hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-5 w-5 text-indigo-500" />
                      <span className="text-foreground">{t.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{t.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>
                        {priorityLabels[t.priority]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {statusLabels[t.status]}
                      </span>
                      {t.tags?.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom templates */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Mis Plantillas ({custom.length})
        </h2>
        {custom.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm mb-1">No hay plantillas personalizadas</p>
              <p className="text-muted-foreground text-xs mb-4">Crea plantillas para estandarizar la creación de tareas</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Crear primera plantilla
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {custom.map((t) => {
              const Icon = getTemplateIcon(t.name);
              return (
                <Card key={t.id} className="bg-card border-border hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-5 w-5 text-indigo-500" />
                        <span className="text-foreground">{t.name}</span>
                      </CardTitle>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(t)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-3 opacity-70">{t.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>
                        {priorityLabels[t.priority]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {statusLabels[t.status]}
                      </span>
                      {t.tags?.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">
              {editId ? "Editar Plantilla" : "Nueva Plantilla"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <Label className="text-foreground">Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Bug crítico, Feature request..."
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Título de la tarea *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Fix: [descripción del bug]"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción o checklist predefinido (soporta Markdown)"
                rows={6}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Estado inicial</Label>
                <select
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm"
                >
                  <option value="TODO">Por hacer</option>
                  <option value="INPROGRESS">En progreso</option>
                  <option value="INREVIEW">En revisión</option>
                  <option value="DONE">Hecho</option>
                </select>
              </div>
              <div>
                <Label className="text-foreground">Prioridad</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm"
                >
                  <option value="NONE">Sin prioridad</option>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-foreground">Etiquetas</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Separadas por comas: bug, urgente, frontend"
                className="bg-background border-border text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editId ? "Guardar Cambios" : "Crear Plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
