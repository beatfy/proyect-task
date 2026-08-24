"use client";

import React, { useState } from "react";
import { MindMapRecord } from "@/lib/types/mindmap";
import { MINDMAP_TEMPLATES } from "./MindMapTemplates";
import {
  Plus,
  Search,
  Star,
  FolderOpen,
  Trash2,
  Copy,
  Network,
  ArrowRight,
  Lightbulb,
  Rocket,
  Target,
  PlusCircle,
  MoreVertical,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MindMapListProps {
  initialMaps: MindMapRecord[];
  projects?: Array<{ id: string; name: string; color: string }>;
}

export const MindMapList: React.FC<MindMapListProps> = ({
  initialMaps,
  projects = [],
}) => {
  const router = useRouter();
  const [maps, setMaps] = useState<MindMapRecord[]>(initialMaps);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // New Map Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTemplateId, setNewTemplateId] = useState<string>("brainstorming");
  const [newProjectId, setNewProjectId] = useState<string>("none");

  const handleCreateMap = async (templateIdToUse?: string) => {
    try {
      setIsLoading(true);
      const selectedTemplateId = templateIdToUse || newTemplateId;
      const template = MINDMAP_TEMPLATES.find((t) => t.id === selectedTemplateId);

      const title =
        newTitle.trim() ||
        (template ? template.name : "Nuevo Mapa Mental");

      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newDescription.trim() || null,
          templateId: selectedTemplateId,
          projectId: newProjectId !== "none" ? newProjectId : undefined,
        }),
      });

      if (!res.ok) throw new Error("Error al crear el mapa");

      const created = await res.json();
      toast.success("Mapa mental creado");
      setIsCreating(false);
      router.push(`/mindmaps/${created.id}`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear el mapa mental");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (map: MindMapRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const updatedFav = !map.isFavorite;
      setMaps((prev) =>
        prev.map((m) => (m.id === map.id ? { ...m, isFavorite: updatedFav } : m))
      );

      await fetch(`/api/mindmaps/${map.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: updatedFav }),
      });
    } catch (err) {
      toast.error("Error al actualizar favoritos");
    }
  };

  const handleDeleteMap = async (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("¿Deseas eliminar este mapa mental?")) return;

    try {
      setMaps((prev) => prev.filter((m) => m.id !== mapId));
      const res = await fetch(`/api/mindmaps/${mapId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Mapa mental eliminado");
    } catch (err) {
      toast.error("Error al eliminar el mapa");
    }
  };

  const handleDuplicateMap = async (map: MindMapRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${map.title} (Copia)`,
          description: map.description,
          data: map.data,
          projectId: map.projectId,
        }),
      });
      if (!res.ok) throw new Error();
      const duplicate = await res.json();
      setMaps((prev) => [duplicate, ...prev]);
      toast.success("Mapa duplicado");
    } catch (err) {
      toast.error("Error al duplicar");
    }
  };

  // Filter maps
  const filteredMaps = maps.filter((map) => {
    const matchesSearch =
      map.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (map.description && map.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject =
      selectedProjectId === "all" || map.projectId === selectedProjectId;

    const matchesFavorite = !onlyFavorites || map.isFavorite;

    return matchesSearch && matchesProject && matchesFavorite;
  });

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case "Lightbulb":
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
      case "Rocket":
        return <Rocket className="w-4 h-4 text-rose-500" />;
      case "Target":
        return <Target className="w-4 h-4 text-primary" />;
      case "Network":
        return <Network className="w-4 h-4 text-primary" />;
      case "PlusCircle":
      default:
        return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Mapas Mentales
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
              {maps.length} {maps.length === 1 ? "mapa" : "mapas"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Lienzo infinito para estructurar ideas, flujos de trabajo y transformarlas en tareas.
          </p>
        </div>

        <Button
          onClick={() => {
            setNewTitle("");
            setNewDescription("");
            setNewTemplateId("brainstorming");
            setIsCreating(true);
          }}
          className="gap-2 shrink-0 font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Mapa
        </Button>
      </div>

      {/* Starter Templates */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plantillas de Inicio
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {MINDMAP_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => handleCreateMap(tmpl.id)}
              className="group cursor-pointer rounded-xl bg-card hover:bg-card/80 border border-border hover:border-primary/50 p-3.5 transition-all shadow-sm hover:shadow flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                  {getTemplateIcon(tmpl.icon)}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tmpl.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {tmpl.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground group-hover:text-primary font-medium transition-colors">
                <span>Comenzar</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-48 text-xs">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={onlyFavorites ? "secondary" : "outline"}
            size="sm"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className="text-xs gap-1.5 shrink-0"
          >
            <Star className={cn("w-3.5 h-3.5", onlyFavorites && "fill-amber-500 text-amber-500")} />
            <span>Favoritos</span>
          </Button>
        </div>
      </div>

      {/* Grid of Mind Maps */}
      {filteredMaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
            <Network className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground">No hay mapas registrados</h3>
            <p className="text-xs text-muted-foreground">
              Comienza un nuevo lienzo o selecciona una de las plantillas.
            </p>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            size="sm"
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Mapa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaps.map((map) => {
            const nodeCount = map.data?.nodes?.length || 0;
            const formattedDate = new Date(map.updatedAt).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <Link key={map.id} href={`/mindmaps/${map.id}`}>
                <Card className="group h-full bg-card hover:bg-card/80 border-border hover:border-primary/50 transition-all shadow-sm hover:shadow flex flex-col justify-between cursor-pointer">
                  <CardHeader className="pb-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {map.title}
                        </CardTitle>
                        {map.description && (
                          <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                            {map.description}
                          </CardDescription>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(map, e)}
                          className="p-1 rounded text-muted-foreground hover:text-amber-500 transition-colors"
                          title={map.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        >
                          <Star
                            className={cn(
                              "w-3.5 h-3.5",
                              map.isFavorite && "fill-amber-500 text-amber-500"
                            )}
                          />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem
                              onClick={(e) => handleDuplicateMap(map, e)}
                              className="gap-2 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Duplicar</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handleDeleteMap(map.id, e)}
                              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded border border-border">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        <span>{nodeCount} {nodeCount === 1 ? "nodo" : "nodos"}</span>
                      </div>

                      {map.project && (
                        <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded border border-border text-secondary-foreground">
                          <FolderOpen className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{map.project.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formattedDate}
                    </span>
                    <span className="text-foreground font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                      Abrir <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create New Mind Map Modal */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Nuevo Mapa Mental
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define el título y selecciona una plantilla para comenzar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                placeholder="Ej: Plan Estratégico, Arquitectura..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descripción (Opcional)</Label>
              <Input
                placeholder="Breve resumen del objetivo"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Plantilla</Label>
              <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecciona plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {MINDMAP_TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto (Opcional)</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Sin proyecto específico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto específico</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleCreateMap()}
              disabled={isLoading}
            >
              {isLoading ? "Creando..." : "Crear Mapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
