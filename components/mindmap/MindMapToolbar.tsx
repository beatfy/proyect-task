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
  RotateCcw,
  RotateCw,
  Plus,
  HelpCircle,
  FolderOpen,
  ArrowLeft,
  LayoutGrid,
  FileJson,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Clock,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { cn } from "@/lib/utils";
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

    // Get children of root
    const children = data.edges
      .filter((e) => e.source === root.id)
      .map((e) => data.nodes.find((n) => n.id === e.target))
      .filter(Boolean) as NodeData[];

    const half = Math.ceil(children.length / 2);
    const rightChildren = children.slice(0, half);
    const leftChildren = children.slice(half);

    // Layout right children
    rightChildren.forEach((child, index) => {
      const childY = rootY - ((rightChildren.length - 1) * 110) / 2 + index * 110;
      const childX = rootX + 280;
      positionedNodes[child.id] = { x: childX, y: childY };

      // Layout grandchildren
      const grandChildren = data.edges
        .filter((e) => e.source === child.id)
        .map((e) => data.nodes.find((n) => n.id === e.target))
        .filter(Boolean) as NodeData[];

      grandChildren.forEach((gc, gcIndex) => {
        positionedNodes[gc.id] = {
          x: childX + 260,
          y: childY - ((grandChildren.length - 1) * 90) / 2 + gcIndex * 90,
        };
      });
    });

    // Layout left children
    leftChildren.forEach((child, index) => {
      const childY = rootY - ((leftChildren.length - 1) * 110) / 2 + index * 110;
      const childX = rootX - 280;
      positionedNodes[child.id] = { x: childX, y: childY };

      // Layout grandchildren
      const grandChildren = data.edges
        .filter((e) => e.source === child.id)
        .map((e) => data.nodes.find((n) => n.id === e.target))
        .filter(Boolean) as NodeData[];

      grandChildren.forEach((gc, gcIndex) => {
        positionedNodes[gc.id] = {
          x: childX - 260,
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
    toast.success("Mapa mental organizado automáticamente");
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
        label: "🎯 Plan de Ejecución",
        desc: "Definición de etapas clave y responsables",
        color: "indigo" as const,
        checklist: [
          { id: `c-${Date.now()}-1`, text: "Fijar plazos de entrega", completed: false },
          { id: `c-${Date.now()}-2`, text: "Asignar roles principales", completed: false },
        ],
      },
      {
        label: "🛡️ Análisis de Riesgos",
        desc: "Posibles cuellos de botella y mitigaciones",
        color: "amber" as const,
      },
      {
        label: "📈 Estrategia de Crecimiento",
        desc: "Escalabilidad y métricas de retención",
        color: "emerald" as const,
      },
      {
        label: "⚡ Automatización",
        desc: "Herramientas e integraciones para optimizar",
        color: "cyan" as const,
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

    toast.success("4 ramas de ideas generadas para: " + targetNode.label);
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
    toast.success("Archivo JSON descargado");
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
          toast.error("Formato de archivo inválido");
        }
      } catch (err) {
        toast.error("Error al leer el archivo JSON");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export PNG screenshot
  const handleExportPNG = () => {
    toast.info("Generando imagen PNG...");
    setTimeout(() => {
      toast.success("Exportación iniciada");
    }, 500);
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
        {/* Left Section: Back, Title, Project & Save state */}
        <div className="flex items-center gap-2 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-xl pointer-events-auto">
          <Link href="/mindmaps">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Volver a lista de Mapas"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Volver</span>
            </Button>
          </Link>

          <div className="h-4 w-px bg-slate-800" />

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
                className="bg-slate-950 text-white text-xs font-semibold px-2 py-1 rounded border border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
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
              className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-slate-800/60 max-w-[160px] sm:max-w-xs truncate"
              title="Haz clic para cambiar el título"
            >
              {title}
            </h1>
          )}

          {projectName && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              <FolderOpen className="w-3 h-3" />
              {projectName}
            </span>
          )}

          <div className="h-4 w-px bg-slate-800" />

          {/* Save status badge */}
          <div className="flex items-center gap-1.5 px-2">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Guardando...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden sm:inline">Guardado</span>
              </span>
            )}
            {saveStatus === "unsaved" && (
              <button
                type="button"
                onClick={onSaveManual}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                <Save className="w-3 h-3" />
                <span className="hidden sm:inline">Guardar</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Actions, AI, Export, Settings */}
        <div className="flex items-center gap-2 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-xl pointer-events-auto">
          {/* AI Generator Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAIBrainstorm}
            className="h-8 px-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 gap-1.5"
            title="Generar ideas asociadas con IA"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline text-xs font-medium">Asistente Ideas</span>
          </Button>

          {/* Auto Arrange Layout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoArrange}
            className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-800"
            title="Auto-organizar ramas y nodos"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden lg:inline text-xs ml-1">Organizar</span>
          </Button>

          {/* Export / Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-300 hover:text-white hover:bg-slate-800"
                title="Exportar o importar mapa"
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline text-xs">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
              <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer">
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>Descargar JSON</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-400" />
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

          <div className="h-4 w-px bg-slate-800" />

          {/* Help / Shortcuts Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Atajos de teclado y ayuda"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Pantalla completa"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Bottom Center Floating Zoom & Node Controls Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-full px-3 py-1.5 shadow-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRootNode}
          className="h-8 px-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs gap-1.5 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Añadir Nodo</span>
        </Button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(0.85)}
          className="h-7 w-7 rounded-full text-slate-300 hover:text-white hover:bg-slate-800"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="text-xs font-mono font-medium text-slate-300 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800"
          title="Restablecer al 100%"
        >
          {zoomPercent}%
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleZoom(1.15)}
          className="h-7 w-7 rounded-full text-slate-300 hover:text-white hover:bg-slate-800"
          title="Acercar (Zoom In)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleFitView}
          className="h-7 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
          title="Ajustar mapa a la pantalla"
        >
          Ajustar
        </Button>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <HelpCircle className="w-5 h-5" />
              Atajos y Guía de Uso
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Usa estos atajos para crear y organizar mapas mentales a toda velocidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Crear nodo hijo</span>
              <kbd className="px-2 py-1 bg-slate-800 rounded text-indigo-300 font-mono">Tab</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Crear nodo hermano</span>
              <kbd className="px-2 py-1 bg-slate-800 rounded text-indigo-300 font-mono">Enter</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Eliminar nodo seleccionado</span>
              <kbd className="px-2 py-1 bg-slate-800 rounded text-rose-300 font-mono">Supr / Backspace</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Desplazar lienzo (Pan)</span>
              <span className="text-slate-400 font-mono">Espacio + Arrastrar / Rueda</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Conectar nodos libremente</span>
              <span className="text-slate-400">Arrastrar desde el puerto derecho del nodo</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Deshacer / Rehacer</span>
              <kbd className="px-2 py-1 bg-slate-800 rounded text-slate-300 font-mono">Ctrl + Z / Ctrl + Y</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-300">Editar texto de nodo</span>
              <span className="text-slate-400 font-mono">Doble Clic en nodo</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
