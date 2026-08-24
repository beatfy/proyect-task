"use client";

import React, { useState, useEffect } from "react";
import { MindMapRecord } from "@/lib/types/mindmap";
import { MINDMAP_TEMPLATES, TemplateDefinition } from "./MindMapTemplates";
import {
  Plus,
  Search,
  Star,
  FolderOpen,
  Trash2,
  Copy,
  Network,
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
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
      toast.success("Mapa mental creado con éxito");
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
    if (!confirm("¿Seguro que deseas eliminar este mapa mental?")) return;

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
      toast.success("Mapa mental duplicado");
    } catch (err) {
      toast.error("Error al duplicar el mapa");
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
        return <Lightbulb className="w-5 h-5 text-amber-400" />;
      case "Rocket":
        return <Rocket className="w-5 h-5 text-rose-400" />;
      case "Target":
        return <Target className="w-5 h-5 text-blue-400" />;
      case "Network":
        return <Network className="w-5 h-5 text-indigo-400" />;
      case "PlusCircle":
      default:
        return <PlusCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-950 border border-indigo-500/20 p-6 md:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <Network className="w-3.5 h-3.5" />
              Lienzo Infinito & Ideas
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Mapas Mentales Interactivos
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Estructura proyectos, conecta ideas arrastrando nodos con físicas fluidas, genera lluvia de ideas y conviértelas en tareas reales de tu equipo con un solo clic.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => {
              setNewTitle("");
              setNewDescription("");
              setNewTemplateId("brainstorming");
              setIsCreating(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25 gap-2 shrink-0 self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            Nuevo Mapa Mental
          </Button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Starter Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Plantillas de Inicio Rápido
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {MINDMAP_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => handleCreateMap(tmpl.id)}
              className="group relative cursor-pointer rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 p-4 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center group-hover:border-indigo-500/40 transition-colors">
                  {getTemplateIcon(tmpl.icon)}
                </div>
                <h3 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                  {tmpl.name}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Comenzar</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar mapa por título o nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900/80 border-slate-800 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-48 bg-slate-900/80 border-slate-800 text-xs">
              <SelectValue placeholder="Filtrar por proyecto" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={onlyFavorites ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={cn(
              "text-xs gap-1.5 shrink-0",
              onlyFavorites
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "border-slate-800 text-slate-400 hover:text-white"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", onlyFavorites && "fill-amber-400 text-amber-400")} />
            <span>Favoritos</span>
          </Button>
        </div>
      </div>

      {/* Grid of Mind Maps */}
      {filteredMaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Network className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No se encontraron mapas mentales</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Crea tu primer mapa mental con un lienzo infinito o selecciona una de las plantillas superiores.
            </p>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Crear Mapa Mental
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
                <Card className="group h-full bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-indigo-500/40 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] flex flex-col justify-between cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                            {map.title}
                          </CardTitle>
                        </div>
                        {map.description && (
                          <CardDescription className="text-xs text-slate-400 line-clamp-2">
                            {map.description}
                          </CardDescription>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(map, e)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400"
                          title={map.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        >
                          <Star
                            className={cn(
                              "w-4 h-4",
                              map.isFavorite
                                ? "fill-amber-400 text-amber-400"
                                : "hover:scale-110"
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
                              className="p-1 rounded text-slate-400 hover:text-white"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-slate-900 border-slate-800 text-slate-200">
                            <DropdownMenuItem
                              onClick={(e) => handleDuplicateMap(map, e)}
                              className="gap-2 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              <span>Duplicar</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem
                              onClick={(e) => handleDeleteMap(map.id, e)}
                              className="gap-2 cursor-pointer text-rose-400 focus:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>{nodeCount} {nodeCount === 1 ? "nodo" : "nodos"}</span>
                      </div>

                      {map.project && (
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-white"
                          style={{
                            backgroundColor: `${map.project.color}20`,
                            border: `1px solid ${map.project.color}40`,
                          }}
                        >
                          <FolderOpen className="w-3 h-3" style={{ color: map.project.color }} />
                          <span className="truncate max-w-[120px]">{map.project.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formattedDate}
                    </span>
                    <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform font-medium">
                      Abrir lienzo →
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
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Network className="w-5 h-5 text-indigo-400" />
              Crear Nuevo Mapa Mental
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Personaliza el título y elige la plantilla inicial para tu lienzo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Título del Mapa</Label>
              <Input
                placeholder="Ej: Estrategia Q3, Lanzamiento App, etc."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Descripción (Opcional)</Label>
              <Input
                placeholder="Breve resumen del objetivo del mapa"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Plantilla Inicial</Label>
              <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                  <SelectValue placeholder="Selecciona una plantilla" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {MINDMAP_TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Asociar a Proyecto (Opcional)</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                  <SelectValue placeholder="Sin proyecto específico" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="none">Sin proyecto específico</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: p.color || "#6366f1" }}
                        />
                        <span>{p.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {isLoading ? "Creando lienzo..." : "Comenzar Mapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
