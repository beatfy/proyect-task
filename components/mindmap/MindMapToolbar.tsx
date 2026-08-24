"use client";

import React, { useState, useRef } from "react";
import {
  MindMapData,
  MindMapNode as NodeData,
  MindMapEdge,
} from "@/lib/types/mindmap";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Upload,
  Sparkles,
  Save,
  Plus,
  HelpCircle,
  FolderOpen,
  ArrowLeft,
  LayoutGrid,
  FileJson,
  Check,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface MindMapToolbarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  data: MindMapData;
  onChange: (data: MindMapData) => void;
  onAddRootNode: () => void;
  onAddChildToSelected: () => void;
  selectedNodeId: string | null;
  saveStatus: "saved" | "saving" | "unsaved";
  onSaveManual: () => void;
  projectName?: string | null;
}

export const MindMapToolbar: React.FC<MindMapToolbarProps> = ({
  title,
  onTitleChange,
  data,
  onChange,
  onAddRootNode,
  onAddChildToSelected,
  selectedNodeId,
  saveStatus,
  onSaveManual,
  projectName,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTitleSubmit = () => {
    if (tempTitle.trim()) {
      onTitleChange(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleZoom = (factor: number) => {
    const currentZoom = data.viewport?.zoom || 1;
    const newZoom = Math.min(Math.max(currentZoom * factor, 0.2), 2.5);
    onChange({
      ...data,
      viewport: {
        ...data.viewport,
        zoom: newZoom,
      },
    });
  };

  const handleResetZoom = () => {
    onChange({
      ...data,
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
      },
    });
  };

  const handleFitView = () => {
    if (!data.nodes.length) return;
    const minX = Math.min(...data.nodes.map((n) => n.x));
    const maxX = Math.max(...data.nodes.map((n) => n.x + 220));
    const minY = Math.min(...data.nodes.map((n) => n.y));
    const maxY = Math.max(...data.nodes.map((n) => n.y + 120));

    const width = maxX - minX;
    const height = maxY - minY;

    const screenW = window.innerWidth - 100;
    const screenH = window.innerHeight - 150;

    const scaleX = screenW / (width || 1);
    const scaleY = screenH / (height || 1);
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY, 1.2), 0.3), 1.5);

    const x = (screenW - width * zoom) / 2 - minX * zoom;
    const y = (screenH - height * zoom) / 2 - minY * zoom;

    onChange({
      ...data,
      viewport: { x, y, zoom },
    });
  };

  // Auto-arrange hierarchical layout
  const handleAutoArrange = () => {
    const root = data.nodes.find((n) => n.isRoot) || data.nodes[0];
    if (!root) return;

    const positionedNodes: Record<string, { x: number; y: number }> = {};
    const rootX = 600;
    const rootY = 400;
    positionedNodes[root.id] = { x: rootX, y: rootY };

    const children = data.edges
      .filter((e) => e.source === root.id)
      .map((e) => data.nodes.find((n) => n.id === e.target))
      .filter(Boolean) as NodeData[];

    const half = Math.ceil(children.length / 2);
    const rightChildren = children.slice(0, half);
    const leftChildren = children.slice(half);

    rightChildren.forEach((child, index) => {
      const childY = rootY - ((rightChildren.length - 1) * 110) / 2 + index * 110;
      const childX = rootX + 270;
      positionedNodes[child.id] = { x: childX, y: childY };

      const grandChildren = data.edges
        .filter((e) => e.source === child.id)
        .map((e) => data.nodes.find((n) => n.id === e.target))
        .filter(Boolean) as NodeData[];

      grandChildren.forEach((gc, gcIndex) => {
        positionedNodes[gc.id] = {
          x: childX + 250,
          y: childY - ((grandChildren.length - 1) * 90) / 2 + gcIndex * 90,
        };
      });
    });

    leftChildren.forEach((child, index) => {
      const childY = rootY - ((leftChildren.length - 1) * 110) / 2 + index * 110;
      const childX = rootX - 270;
      positionedNodes[child.id] = { x: childX, y: childY };

      const grandChildren = data.edges
        .filter((e) => e.source === child.id)
        .map((e) => data.nodes.find((n) => n.id === e.target))
        .filter(Boolean) as NodeData[];

      grandChildren.forEach((gc, gcIndex) => {
        positionedNodes[gc.id] = {
          x: childX - 250,
          y: childY - ((grandChildren.length - 1) * 90) / 2 + gcIndex * 90,
        };
      });
    });

    const updatedNodes = data.nodes.map((n) => {
      if (positionedNodes[n.id]) {
        return {
          ...n,
          x: positionedNodes[n.id].x,
          y: positionedNodes[n.id].y,
        };
      }
      return n;
    });

    onChange({
      ...data,
      nodes: updatedNodes,
    });
    toast.success("Organización completada");
  };

  // AI Ideas / Smart Brainstorm Generator
  const handleAIBrainstorm = () => {
    const targetNode = selectedNodeId
      ? data.nodes.find((n) => n.id === selectedNodeId)
      : data.nodes.find((n) => n.isRoot) || data.nodes[0];

    if (!targetNode) {
      toast.error("Selecciona un nodo para generar ideas asociadas");
      return;
    }

    const ideas = [
      {
        label: "Plan de Ejecución",
        desc: "Definición de etapas clave y responsables",
        color: "indigo" as const,
        checklist: [
          { id: `c-${Date.now()}-1`, text: "Fijar plazos de entrega", completed: false },
          { id: `c-${Date.now()}-2`, text: "Asignar roles principales", completed: false },
        ],
      },
      {
        label: "Análisis de Riesgos",
        desc: "Posibles cuellos de botella y contingencias",
        color: "amber" as const,
      },
      {
        label: "Estrategia de Crecimiento",
        desc: "Escalabilidad y métricas de retención",
        color: "emerald" as const,
      },
      {
        label: "Automatización & Procesos",
        desc: "Herramientas e integraciones clave",
        color: "blue" as const,
      },
    ];

    const newNodes: NodeData[] = [];
    const newEdges: MindMapEdge[] = [];

    ideas.forEach((idea, i) => {
      const id = `ai-node-${Date.now()}-${i}`;
      const angle = (i * Math.PI) / 2;
      const radius = 260;
      const x = Math.round(targetNode.x + Math.cos(angle) * radius);
      const y = Math.round(targetNode.y + Math.sin(angle) * radius);

      newNodes.push({
        id,
        label: idea.label,
        description: idea.desc,
        x,
        y,
        parentId: targetNode.id,
        color: idea.color,
        shape: "card",
        checklist: idea.checklist,
      });

      newEdges.push({
        id: `ai-edge-${Date.now()}-${i}`,
        source: targetNode.id,
        target: id,
        style: "curved",
      });
    });

    onChange({
      ...data,
      nodes: [...data.nodes, ...newNodes],
      edges: [...data.edges, ...newEdges],
    });

    toast.success("Ramas generadas para: " + targetNode.label);
  };

  // Export JSON
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify({ title, data }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-mindmap.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo JSON exportado");
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.data && parsed.data.nodes) {
          onChange(parsed.data);
          if (parsed.title) onTitleChange(parsed.title);
          toast.success("Mapa mental importado con éxito");
        } else {
          toast.error("Formato no compatible");
        }
      } catch (err) {
        toast.error("Error al leer el archivo JSON");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const zoomPercent = Math.round((data.viewport?.zoom || 1) * 100);

  return (
    <>
      {/* Top Floating Bar */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
        {/* Left Section */}
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-xl p-1.5 shadow-sm pointer-events-auto">
          <Link href="/mindmaps">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground text-xs"
              title="Volver a lista de Mapas"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Mapas</span>
            </Button>
          </Link>

          <div className="h-4 w-px bg-border" />

          {/* Title Editor */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
                autoFocus
                className="bg-background text-foreground text-xs font-semibold px-2 py-1 rounded border border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-1 rounded text-primary hover:bg-accent"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h1
              onClick={() => {
                setTempTitle(title);
                setIsEditingTitle(true);
              }}
              className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary cursor-pointer px-2 py-1 rounded hover:bg-accent/40 max-w-[160px] sm:max-w-xs truncate transition-colors"
              title="Haz clic para cambiar el título"
            >
              {title}
            </h1>
          )}

          {projectName && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
              <FolderOpen className="w-3 h-3" />
              {projectName}
            </span>
          )}

          <div className="h-4 w-px bg-border" />

          {/* Save status badge */}
          <div className="flex items-center gap-1.5 px-2">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[11px] text-amber-500 animate-pulse">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Guardando...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden sm:inline">Guardado</span>
              </span>
            )}
            {saveStatus === "unsaved" && (
              <button
                type="button"
                onClick={onSaveManual}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Save className="w-3 h-3" />
                <span className="hidden sm:inline">Guardar</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-xl border border-border rounded-xl p-1.5 shadow-sm pointer-events-auto">
          {/* AI Generator Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAIBrainstorm}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Generar ideas asociadas"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline font-medium">Asistente</span>
          </Button>

          {/* Auto Arrange Layout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoArrange}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title="Auto-organizar ramas y nodos"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden lg:inline ml-1.5">Organizar</span>
          </Button>

          {/* Export / Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                title="Exportar o importar mapa"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">JSON</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover border-border text-popover-foreground shadow-lg">
              <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer text-xs">
                <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Exportar JSON</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 cursor-pointer text-xs"
              >
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Importar JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          <div className="h-4 w-px bg-border" />

          {/* Help / Shortcuts Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Atajos de teclado"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Pantalla completa"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Bottom Center Floating Zoom & Node Controls Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card/90 backdrop-blur-xl border border-border rounded-full px-3 py-1.5 shadow-xl">
        <Button
          variant="default"
          size="sm"
          onClick={onAddRootNode}
          className="h-7 px-3 rounded-full text-xs font-medium gap-1.5 shadow-sm"
        >
          <Plus className="w-3 h-3" />
          <span>Añadir Nodo</span>
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(0.85)}
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          title="Alejar"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="text-xs font-mono font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors"
          title="Restablecer"
        >
          {zoomPercent}%
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(1.15)}
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          title="Acercar"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleFitView}
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-full"
          title="Ajustar a la pantalla"
        >
          Ajustar
        </Button>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="bg-popover border-border text-popover-foreground max-w-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              Atajos de Teclado
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Accesos directos para agilizar el flujo de trabajo en el lienzo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Crear nodo hijo</span>
              <kbd className="px-2 py-0.5 bg-background border border-border rounded text-foreground font-mono text-[11px]">Tab</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Crear nodo hermano</span>
              <kbd className="px-2 py-0.5 bg-background border border-border rounded text-foreground font-mono text-[11px]">Enter</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Eliminar nodo seleccionado</span>
              <kbd className="px-2 py-0.5 bg-background border border-border rounded text-destructive font-mono text-[11px]">Supr / Backspace</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Desplazar lienzo</span>
              <span className="text-muted-foreground font-mono">Espacio + Arrastrar</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Conectar nodos</span>
              <span className="text-muted-foreground">Arrastrar desde el puerto circular</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Deshacer / Rehacer</span>
              <kbd className="px-2 py-0.5 bg-background border border-border rounded text-foreground font-mono text-[11px]">Ctrl + Z / Ctrl + Y</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
              <span className="text-foreground">Editar título</span>
              <span className="text-muted-foreground font-mono">Doble Clic</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
