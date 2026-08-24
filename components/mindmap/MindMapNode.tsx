"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MindMapNode as NodeData,
  NodeColor,
  NodeShape,
  ChecklistItem,
} from "@/lib/types/mindmap";
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  X,
  Palette,
  Shapes,
  ListTodo,
  Tag,
  AlertCircle,
  MoreHorizontal,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface MindMapNodeProps {
  node: NodeData;
  isSelected: boolean;
  hasChildren: boolean;
  isConnectingSource: boolean;
  onSelect: (nodeId: string, multi?: boolean) => void;
  onUpdate: (nodeId: string, updates: Partial<NodeData>) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentNodeId: string, direction?: "right" | "left" | "bottom" | "top") => void;
  onAddSibling: (nodeId: string) => void;
  onStartConnect: (nodeId: string, e: React.MouseEvent) => void;
  onEndConnect: (nodeId: string) => void;
  onExportToTask: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  zoom: number;
}

const COLOR_MAP: Record<NodeColor, {
  bg: string;
  border: string;
  text: string;
  glow: string;
  accent: string;
  badge: string;
}> = {
  indigo: {
    bg: "bg-indigo-950/80 dark:bg-indigo-950/90",
    border: "border-indigo-500/60 hover:border-indigo-400",
    text: "text-indigo-100",
    glow: "shadow-indigo-500/20",
    accent: "bg-indigo-500",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  blue: {
    bg: "bg-blue-950/80 dark:bg-blue-950/90",
    border: "border-blue-500/60 hover:border-blue-400",
    text: "text-blue-100",
    glow: "shadow-blue-500/20",
    accent: "bg-blue-500",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  emerald: {
    bg: "bg-emerald-950/80 dark:bg-emerald-950/90",
    border: "border-emerald-500/60 hover:border-emerald-400",
    text: "text-emerald-100",
    glow: "shadow-emerald-500/20",
    accent: "bg-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  amber: {
    bg: "bg-amber-950/80 dark:bg-amber-950/90",
    border: "border-amber-500/60 hover:border-amber-400",
    text: "text-amber-100",
    glow: "shadow-amber-500/20",
    accent: "bg-amber-500",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  rose: {
    bg: "bg-rose-950/80 dark:bg-rose-950/90",
    border: "border-rose-500/60 hover:border-rose-400",
    text: "text-rose-100",
    glow: "shadow-rose-500/20",
    accent: "bg-rose-500",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  purple: {
    bg: "bg-purple-950/80 dark:bg-purple-950/90",
    border: "border-purple-500/60 hover:border-purple-400",
    text: "text-purple-100",
    glow: "shadow-purple-500/20",
    accent: "bg-purple-500",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  cyan: {
    bg: "bg-cyan-950/80 dark:bg-cyan-950/90",
    border: "border-cyan-500/60 hover:border-cyan-400",
    text: "text-cyan-100",
    glow: "shadow-cyan-500/20",
    accent: "bg-cyan-500",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  slate: {
    bg: "bg-slate-900/90 dark:bg-slate-900/95",
    border: "border-slate-600 hover:border-slate-400",
    text: "text-slate-100",
    glow: "shadow-slate-500/10",
    accent: "bg-slate-500",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  orange: {
    bg: "bg-orange-950/80 dark:bg-orange-950/90",
    border: "border-orange-500/60 hover:border-orange-400",
    text: "text-orange-100",
    glow: "shadow-orange-500/20",
    accent: "bg-orange-500",
    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  },
};

const SHAPES: NodeShape[] = ["rounded", "pill", "rectangle", "card", "sticky", "circle", "cloud"];
const COLORS: NodeColor[] = ["indigo", "blue", "emerald", "amber", "rose", "purple", "cyan", "slate", "orange"];

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  isSelected,
  hasChildren,
  isConnectingSource,
  onSelect,
  onUpdate,
  onDelete,
  onAddChild,
  onAddSibling,
  onStartConnect,
  onEndConnect,
  onExportToTask,
  onToggleCollapse,
  zoom,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(node.label);
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const colorConfig = COLOR_MAP[node.color || "indigo"] || COLOR_MAP.indigo;
  const shape = node.shape || (node.isRoot ? "rounded" : "card");

  useEffect(() => {
    setEditLabel(node.label);
  }, [node.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveLabel = () => {
    if (editLabel.trim() && editLabel !== node.label) {
      onUpdate(node.id, { label: editLabel.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      handleSaveLabel();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setEditLabel(node.label);
      setIsEditing(false);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    const currentList = node.checklist || [];
    const updated = [
      ...currentList,
      {
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        text: newChecklistText.trim(),
        completed: false,
      },
    ];
    onUpdate(node.id, { checklist: updated });
    setNewChecklistText("");
    setShowChecklistInput(false);
  };

  const handleToggleChecklist = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = node.checklist || [];
    const updated = currentList.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onUpdate(node.id, { checklist: updated });
  };

  const handleDeleteChecklistItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = node.checklist || [];
    const updated = currentList.filter((item) => item.id !== itemId);
    onUpdate(node.id, { checklist: updated });
  };

  const completedCount = node.checklist?.filter((c) => c.completed).length || 0;
  const totalCount = node.checklist?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Shape specific CSS styling
  const getShapeClasses = () => {
    switch (shape) {
      case "pill":
        return "rounded-full px-6 py-3";
      case "rectangle":
        return "rounded-none p-4";
      case "circle":
        return "rounded-full aspect-square flex flex-col items-center justify-center p-6 text-center";
      case "sticky":
        return "rounded-sm p-4 shadow-xl rotate-[-1deg] border-t-4 border-t-amber-400 bg-amber-950/90 text-amber-100 border-amber-500/40";
      case "cloud":
        return "rounded-[2rem] p-5 shadow-2xl border-dashed";
      case "card":
      default:
        return "rounded-2xl p-4";
    }
  };

  return (
    <div
      id={`node-${node.id}`}
      data-node-id={node.id}
      className={cn(
        "group absolute select-none transition-shadow duration-200 backdrop-blur-md border cursor-grab active:cursor-grabbing",
        getShapeClasses(),
        shape !== "sticky" && colorConfig.bg,
        shape !== "sticky" && colorConfig.border,
        shape !== "sticky" && colorConfig.text,
        isSelected
          ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 shadow-2xl scale-[1.02] z-30"
          : "shadow-lg hover:shadow-xl z-10",
        node.isRoot && "ring-2 ring-indigo-500/50 shadow-indigo-500/20 font-bold",
        isConnectingSource && "ring-2 ring-emerald-400 animate-pulse"
      )}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        minWidth: shape === "circle" ? "140px" : node.isRoot ? "220px" : "180px",
        maxWidth: "340px",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      onMouseUp={() => {
        onEndConnect(node.id);
      }}
    >
      {/* Port Anchor (Right Connect Handle) */}
      <div
        title="Arrastra para conectar con otro nodo"
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-indigo-500/80 hover:bg-indigo-400 hover:scale-125 border-2 border-slate-900 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-crosshair z-40"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id, e);
        }}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-ping" />
      </div>

      {/* Quick Add Child Button (Right) */}
      <button
        type="button"
        title="Añadir nodo hijo a la derecha (Tab)"
        className="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id, "right");
        }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Quick Add Child Button (Bottom) */}
      <button
        type="button"
        title="Añadir nodo hijo abajo"
        className="absolute left-1/2 -translate-x-1/2 -bottom-9 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id, "bottom");
        }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Collapse / Expand Toggle Button for parent nodes */}
      {hasChildren && (
        <button
          type="button"
          title={node.collapsed ? "Expandir ramas" : "Colapsar ramas"}
          className={cn(
            "absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-slate-700 bg-slate-900 shadow-md flex items-center justify-center transition-transform z-40",
            node.collapsed ? "text-amber-400 bg-amber-950/80 border-amber-500/50" : "text-slate-400 hover:text-white"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
        >
          {node.collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      )}

      {/* Node Header & Actions Bar on Hover / Selection */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {node.priority && node.priority !== "NONE" && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-semibold px-1.5 py-0",
                node.priority === "URGENT" && "bg-rose-500/20 text-rose-300 border-rose-500/40",
                node.priority === "HIGH" && "bg-amber-500/20 text-amber-300 border-amber-500/40",
                node.priority === "MEDIUM" && "bg-blue-500/20 text-blue-300 border-blue-500/40",
                node.priority === "LOW" && "bg-slate-500/20 text-slate-300 border-slate-500/40"
              )}
            >
              {node.priority}
            </Badge>
          )}

          {node.taskId && (
            <Badge
              variant="outline"
              className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] flex items-center gap-1 px-1.5 py-0"
              title="Tarea vinculada en taskProject"
            >
              <CheckSquare className="w-2.5 h-2.5" />
              Tarea
            </Badge>
          )}
        </div>

        {/* Dropdown Menu for Node customization */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Editar Título</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                  <Palette className="w-3.5 h-3.5 text-pink-400" />
                  <span>Color</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-slate-900 border-slate-800 p-2 grid grid-cols-3 gap-1.5">
                  {COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={cn(
                        "w-7 h-7 rounded-md border flex items-center justify-center transition-all",
                        COLOR_MAP[col].bg,
                        COLOR_MAP[col].border,
                        node.color === col && "ring-2 ring-white scale-110"
                      )}
                      onClick={() => onUpdate(node.id, { color: col })}
                      title={col}
                    >
                      {node.color === col && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                  <Shapes className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Forma</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-slate-900 border-slate-800">
                  {SHAPES.map((sh) => (
                    <DropdownMenuItem
                      key={sh}
                      onClick={() => onUpdate(node.id, { shape: sh })}
                      className={cn("capitalize cursor-pointer", node.shape === sh && "font-bold text-indigo-400")}
                    >
                      {sh === "card" && "Tarjeta"}
                      {sh === "rounded" && "Redondeado"}
                      {sh === "pill" && "Píldora"}
                      {sh === "rectangle" && "Rectángulo"}
                      {sh === "sticky" && "Post-it"}
                      {sh === "circle" && "Círculo"}
                      {sh === "cloud" && "Nube"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                onClick={() => setShowChecklistInput(true)}
                className="gap-2 cursor-pointer"
              >
                <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                <span>Añadir Checklist</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onExportToTask(node.id)}
                className="gap-2 cursor-pointer text-emerald-300 focus:text-emerald-200"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Convertir a Tarea</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-slate-800" />

              <DropdownMenuItem
                onClick={() => onDelete(node.id)}
                className="gap-2 cursor-pointer text-rose-400 focus:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Nodo</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Node Main Title */}
      {isEditing ? (
        <div className="flex items-center gap-1 my-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveLabel}
            className="w-full bg-slate-950/90 text-white px-2 py-1 text-sm rounded border border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium"
          />
          <button
            type="button"
            onClick={handleSaveLabel}
            className="p-1 rounded hover:bg-emerald-600/30 text-emerald-400"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <h4
          className={cn(
            "font-medium leading-snug break-words tracking-tight",
            node.fontSize === "xl" && "text-base md:text-lg font-bold",
            node.fontSize === "lg" && "text-sm md:text-base font-semibold",
            (!node.fontSize || node.fontSize === "base") && "text-xs md:text-sm font-medium",
            node.fontSize === "sm" && "text-xs"
          )}
        >
          {node.label}
        </h4>
      )}

      {/* Node Description / Notes */}
      {node.description && (
        <p className="text-[11px] text-slate-300/80 mt-1 leading-relaxed line-clamp-3">
          {node.description}
        </p>
      )}

      {/* Checklist / Subtasks list in Node */}
      {node.checklist && node.checklist.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Subtareas</span>
            <span className="font-mono">{completedCount}/{totalCount} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checklist items */}
          <div className="space-y-1 mt-1.5 max-h-32 overflow-y-auto pr-1">
            {node.checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-1.5 text-xs group/item hover:bg-white/5 px-1 py-0.5 rounded"
                onClick={(e) => handleToggleChecklist(item.id, e)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                  {item.completed ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "truncate text-[11px]",
                      item.completed ? "line-through text-slate-400" : "text-slate-200"
                    )}
                  >
                    {item.text}
                  </span>
                </div>
                <button
                  type="button"
                  className="opacity-0 group-hover/item:opacity-100 p-0.5 text-slate-400 hover:text-rose-400"
                  onClick={(e) => handleDeleteChecklistItem(item.id, e)}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline add checklist item form */}
      {showChecklistInput && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Nueva subtarea..."
            value={newChecklistText}
            onChange={(e) => setNewChecklistText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddChecklistItem();
              if (e.key === "Escape") setShowChecklistInput(false);
            }}
            className="w-full bg-slate-950/80 text-white text-[11px] px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-indigo-400"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddChecklistItem}
            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
