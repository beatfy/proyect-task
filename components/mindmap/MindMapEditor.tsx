"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MindMapData,
  MindMapRecord,
  MindMapNode as NodeData,
} from "@/lib/types/mindmap";
import { MindMapCanvas } from "./MindMapCanvas";
import { MindMapToolbar } from "./MindMapToolbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckSquare, Sparkles, FolderOpen } from "lucide-react";

interface MindMapEditorProps {
  initialMap: MindMapRecord;
  projects?: Array<{ id: string; name: string; color: string }>;
}

export const MindMapEditor: React.FC<MindMapEditorProps> = ({
  initialMap,
  projects = [],
}) => {
  const [mapRecord, setMapRecord] = useState<MindMapRecord>(initialMap);
  const [title, setTitle] = useState(initialMap.title);
  const [data, setData] = useState<MindMapData>(
    initialMap.data || {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      grid: true,
      theme: "modern",
    }
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Export to Task Dialog State
  const [exportingNodeId, setExportingNodeId] = useState<string | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(initialMap.projectId || "");
  const [taskPriority, setTaskPriority] = useState<string>("NONE");
  const [isExporting, setIsExporting] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Debounced Auto-save to API
  const saveMapToServer = useCallback(
    async (currentTitle: string, currentData: MindMapData) => {
      try {
        setSaveStatus("saving");
        const res = await fetch(`/api/mindmaps/${initialMap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentTitle,
            data: currentData,
          }),
        });

        if (!res.ok) throw new Error("Error al guardar");

        const updated = await res.json();
        setMapRecord(updated);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus("unsaved");
        // LocalStorage fallback backup
        try {
          localStorage.setItem(
            `mindmap_backup_${initialMap.id}`,
            JSON.stringify({ title: currentTitle, data: currentData, timestamp: Date.now() })
          );
        } catch (e) {
          // ignore
        }
      }
    },
    [initialMap.id]
  );

  // Trigger auto-save on change
  const handleDataChange = useCallback(
    (newData: MindMapData) => {
      setData(newData);
      setSaveStatus("unsaved");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveMapToServer(title, newData);
      }, 1200);
    },
    [title, saveMapToServer]
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      setSaveStatus("unsaved");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveMapToServer(newTitle, data);
      }, 800);
    },
    [data, saveMapToServer]
  );

  // Add new standalone root node
  const handleAddRootNode = () => {
    const newId = `node-${Date.now()}`;
    const screenCenter = {
      x: Math.round(-(data.viewport?.x || 0) + window.innerWidth / 2 - 100),
      y: Math.round(-(data.viewport?.y || 0) + window.innerHeight / 2 - 50),
    };

    const newNode: NodeData = {
      id: newId,
      label: "Nueva Idea Principal",
      x: screenCenter.x,
      y: screenCenter.y,
      isRoot: data.nodes.length === 0,
      color: "indigo",
      shape: "rounded",
      fontSize: "lg",
    };

    const newData = {
      ...data,
      nodes: [...data.nodes, newNode],
    };

    handleDataChange(newData);
    setSelectedNodeId(newId);
  };

  // Convert Node to Task
  const handleOpenExportToTask = (nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setExportingNodeId(nodeId);
    setTaskPriority(node.priority || "NONE");
  };

  const handleConfirmExportToTask = async () => {
    if (!exportingNodeId) return;

    try {
      setIsExporting(true);
      const res = await fetch(`/api/mindmaps/${initialMap.id}/export-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: exportingNodeId,
          projectId: targetProjectId || undefined,
          priority: taskPriority,
        }),
      });

      if (!res.ok) throw new Error("Error al convertir en tarea");

      const result = await res.json();

      // Update node in state
      const updatedNodes = data.nodes.map((n) =>
        n.id === exportingNodeId
          ? { ...n, taskId: result.task.id, taskTitle: result.task.title }
          : n
      );

      const newData = { ...data, nodes: updatedNodes };
      setData(newData);
      toast.success(`Tarea "${result.task.title}" creada con éxito en el proyecto`);
      setExportingNodeId(null);
    } catch (err) {
      console.error(err);
      toast.error("Hubo un error al crear la tarea");
    } finally {
      setIsExporting(false);
    }
  };

  const exportingNode = exportingNodeId
    ? data.nodes.find((n) => n.id === exportingNodeId)
    : null;

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-screen -m-4 sm:-m-6 md:-m-8 overflow-hidden bg-slate-950">
      {/* Floating Toolbar */}
      <MindMapToolbar
        title={title}
        onTitleChange={handleTitleChange}
        data={data}
        onChange={handleDataChange}
        onAddRootNode={handleAddRootNode}
        onAddChildToSelected={() => {}}
        selectedNodeId={selectedNodeId}
        saveStatus={saveStatus}
        onSaveManual={() => saveMapToServer(title, data)}
        projectName={mapRecord.project?.name}
      />

      {/* Infinite Canvas */}
      <MindMapCanvas
        data={data}
        onChange={handleDataChange}
        onExportToTask={handleOpenExportToTask}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />

      {/* Export Node to Project Task Dialog */}
      <Dialog
        open={!!exportingNodeId}
        onOpenChange={(open) => !open && setExportingNodeId(null)}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-emerald-400">
              <CheckSquare className="w-5 h-5" />
              Convertir Idea en Tarea
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Crea una tarea oficial en taskProject a partir de este nodo del mapa mental.
            </DialogDescription>
          </DialogHeader>

          {exportingNode && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-xs font-semibold text-white">{exportingNode.label}</p>
                {exportingNode.description && (
                  <p className="text-[11px] text-slate-400 mt-1">{exportingNode.description}</p>
                )}
                {exportingNode.checklist && exportingNode.checklist.length > 0 && (
                  <p className="text-[10px] text-indigo-400 mt-2">
                    ✓ Se incluirán {exportingNode.checklist.length} subtareas del checklist.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Asignar a Proyecto</Label>
                <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                    <SelectValue placeholder="Selecciona un proyecto (opcional)" />
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

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Prioridad</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="NONE">Sin Prioridad</SelectItem>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExportingNodeId(null)}
              disabled={isExporting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmExportToTask}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isExporting ? "Creando tarea..." : "Crear Tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
