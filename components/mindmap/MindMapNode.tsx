"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MindMapNode as NodeData,
  NodeColor,
  NodeShape,
} from "@/lib/types/mindmap";
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Edit3,
  Check,
  X,
  Palette,
  Shapes,
  ListTodo,
  MoreHorizontal,
  FolderPlus,
  Flag,
  Link2,
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
  isConnectingMode?: boolean;
  onSelect: (nodeId: string, multi?: boolean) => void;
  onUpdate: (nodeId: string, updates: Partial<NodeData>) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentNodeId: string, direction?: "right" | "left" | "bottom" | "top") => void;
  onAddSibling: (nodeId: string) => void;
  onStartConnect: (nodeId: string, e?: React.MouseEvent) => void;
  onEndConnect: (nodeId: string) => void;
  onExportToTask: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  zoom: number;
}

const ACCENT_STYLES: Record<NodeColor, {
  bar: string;
  dot: string;
  tag: string;
  name: string;
}> = {
  default: {
    bar: "border-l-primary/70",
    dot: "bg-primary",
    tag: "bg-muted text-muted-foreground border-border",
    name: "Neutro",
  },
  indigo: {
    bar: "border-l-indigo-500",
    dot: "bg-indigo-500",
    tag: "bg-indigo-500/10 text-indigo-400 dark:text-indigo-300 border-indigo-500/20",
    name: "Índigo",
  },
  emerald: {
    bar: "border-l-emerald-500",
    dot: "bg-emerald-500",
    tag: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20",
    name: "Esmeralda",
  },
  amber: {
    bar: "border-l-amber-500",
    dot: "bg-amber-500",
    tag: "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20",
    name: "Ámbar",
  },
  rose: {
    bar: "border-l-rose-500",
    dot: "bg-rose-500",
    tag: "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20",
    name: "Rosa",
  },
  purple: {
    bar: "border-l-purple-500",
    dot: "bg-purple-500",
    tag: "bg-purple-500/10 text-purple-400 dark:text-purple-300 border-purple-500/20",
    name: "Púrpura",
  },
  blue: {
    bar: "border-l-sky-500",
    dot: "bg-sky-500",
    tag: "bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/20",
    name: "Azul",
  },
  slate: {
    bar: "border-l-slate-400",
    dot: "bg-slate-400",
    tag: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    name: "Pizarra",
  },
};

const SHAPES: NodeShape[] = ["card", "rounded", "pill", "rectangle", "sticky", "circle"];
const COLORS: NodeColor[] = ["default", "indigo", "emerald", "amber", "rose", "purple", "blue", "slate"];

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  isSelected,
  hasChildren,
  isConnectingSource,
  isConnectingMode = false,
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

  const colorConfig = ACCENT_STYLES[node.color || "default"] || ACCENT_STYLES.default;
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

  // Refined shape styling
  const getShapeClasses = () => {
    switch (shape) {
      case "pill":
        return "rounded-full px-5 py-2.5 border-l-4";
      case "rectangle":
        return "rounded-sm p-4 border-l-4";
      case "circle":
        return "rounded-full aspect-square flex flex-col items-center justify-center p-6 text-center border-2";
      case "sticky":
        return "rounded-md p-4 shadow-sm border-t-2 border-t-amber-400/80 bg-amber-500/5 text-card-foreground border-border";
      case "card":
      case "rounded":
      default:
        return "rounded-xl p-3.5 border-l-4";
    }
  };

  const isTargetCandidate = isConnectingMode && !isConnectingSource;

  return (
    <div
      id={`node-${node.id}`}
      data-node-id={node.id}
      className={cn(
        "group absolute select-none transition-all duration-150 backdrop-blur-xl cursor-grab active:cursor-grabbing",
        "bg-card/95 text-card-foreground border border-border shadow-sm hover:shadow-md",
        getShapeClasses(),
        shape !== "sticky" && colorConfig.bar,
        isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl z-30"
          : "hover:border-border/90 z-10",
        node.isRoot && "border-primary/40 font-semibold shadow-md",
        isConnectingSource && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background animate-pulse z-40",
        isTargetCandidate && "ring-2 ring-primary ring-dashed ring-offset-2 ring-offset-background hover:scale-105 hover:border-primary cursor-pointer z-30 shadow-lg"
      )}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        minWidth: shape === "circle" ? "140px" : node.isRoot ? "220px" : "190px",
        maxWidth: "340px",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isTargetCandidate) {
          onEndConnect(node.id);
          return;
        }
        onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      onMouseUp={() => {
        if (isConnectingMode && !isConnectingSource) {
          onEndConnect(node.id);
        }
      }}
    >
      {/* Full-surface Click Catcher for Connection Target */}
      {isTargetCandidate && (
        <div
          title="Haz clic para conectar aquí"
          className="absolute inset-0 rounded-[inherit] bg-primary/10 hover:bg-primary/25 z-50 cursor-pointer flex items-center justify-center border-2 border-dashed border-primary shadow-lg animate-pulse"
          onClick={(e) => {
            e.stopPropagation();
            onEndConnect(node.id);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onEndConnect(node.id);
          }}
        >
          <div className="bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full shadow-xl pointer-events-none flex items-center gap-1.5 animate-bounce">
            <Link2 className="w-3.5 h-3.5" />
            <span>Vincular aquí</span>
          </div>
        </div>
      )}

      {/* Port Anchor (Right Connect Handle) */}
      <div
        title="Conectar con otro nodo"
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card hover:bg-primary border-2 border-primary shadow-md flex items-center justify-center transition-all cursor-crosshair z-40 hover:scale-125",
          isSelected || isConnectingMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (isTargetCandidate) {
            onEndConnect(node.id);
          } else if (!isConnectingMode) {
            onStartConnect(node.id);
          }
        }}
        onMouseUp={(e) => {
          if (isTargetCandidate) {
            e.stopPropagation();
            onEndConnect(node.id);
          }
        }}
      >
        <div className="w-2 h-2 rounded-full bg-primary group-hover:bg-primary-foreground pointer-events-none" />
      </div>

      {/* Port Anchor (Left Connect Handle) */}
      <div
        title="Conectar con otro nodo"
        className={cn(
          "absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card hover:bg-primary border-2 border-primary shadow-md flex items-center justify-center transition-all cursor-crosshair z-40 hover:scale-125",
          isSelected || isConnectingMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (isTargetCandidate) {
            onEndConnect(node.id);
          } else if (!isConnectingMode) {
            onStartConnect(node.id);
          }
        }}
        onMouseUp={(e) => {
          if (isTargetCandidate) {
            e.stopPropagation();
            onEndConnect(node.id);
          }
        }}
      >
        <div className="w-2 h-2 rounded-full bg-primary group-hover:bg-primary-foreground pointer-events-none" />
      </div>

      {/* Quick Connect Button (Top Right of Node) */}
      {!isConnectingMode && (
        <button
          type="button"
          title="Conectar con otro nodo"
          className={cn(
            "absolute -right-3 -top-3 w-6 h-6 rounded-full bg-card hover:bg-primary text-primary hover:text-primary-foreground border border-primary/40 shadow-md flex items-center justify-center transition-all z-40 hover:scale-110",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onStartConnect(node.id);
          }}
        >
          <Link2 className="w-3 h-3" />
        </button>
      )}

      {/* Quick Add Child Button (Right) */}
      <button
        type="button"
        title="Añadir nodo hijo (Tab)"
        className="absolute -right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-card hover:bg-primary text-muted-foreground hover:text-primary-foreground border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id, "right");
        }}
      >
        <Plus className="w-3 h-3" />
      </button>

      {/* Quick Add Child Button (Bottom) */}
      <button
        type="button"
        title="Añadir nodo abajo"
        className="absolute left-1/2 -translate-x-1/2 -bottom-7 w-5 h-5 rounded-full bg-card hover:bg-primary text-muted-foreground hover:text-primary-foreground border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id, "bottom");
        }}
      >
        <Plus className="w-3 h-3" />
      </button>

      {/* Collapse / Expand Toggle Button */}
      {hasChildren && (
        <button
          type="button"
          title={node.collapsed ? "Expandir" : "Colapsar"}
          className={cn(
            "absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-border bg-card shadow-sm flex items-center justify-center transition-all z-40",
            node.collapsed
              ? "text-primary bg-accent border-primary/40 font-bold"
              : "text-muted-foreground hover:text-foreground"
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

      {/* Node Header & Actions Bar */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {node.isRoot && (
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              Raíz
            </span>
          )}

          {node.priority && node.priority !== "NONE" && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] uppercase font-medium px-1.5 py-0 h-4 border",
                node.priority === "URGENT" && "bg-destructive/10 text-destructive border-destructive/30",
                node.priority === "HIGH" && "bg-amber-500/10 text-amber-500 border-amber-500/30",
                node.priority === "MEDIUM" && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                node.priority === "LOW" && "bg-muted text-muted-foreground border-border"
              )}
            >
              {node.priority}
            </Badge>
          )}

          {node.taskId && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] flex items-center gap-1 px-1.5 py-0 h-4"
              title="Tarea vinculada en taskProject"
            >
              <CheckSquare className="w-2.5 h-2.5" />
              Tarea
            </Badge>
          )}
        </div>

        {/* Dropdown Menu for Node customization */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border text-popover-foreground shadow-lg">
              <DropdownMenuItem
                onClick={() => onStartConnect(node.id)}
                className="gap-2 cursor-pointer text-xs text-primary"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Conectar con otro nodo</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="gap-2 cursor-pointer text-xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Editar Título</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer text-xs">
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Acento de Color</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover border-border p-2 grid grid-cols-4 gap-1.5">
                  {COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={cn(
                        "w-6 h-6 rounded-md border flex items-center justify-center transition-all",
                        ACCENT_STYLES[col].bar,
                        "border-l-4 bg-muted hover:scale-105",
                        node.color === col && "ring-2 ring-primary"
                      )}
                      onClick={() => onUpdate(node.id, { color: col })}
                      title={ACCENT_STYLES[col].name}
                    >
                      {node.color === col && <Check className="w-2.5 h-2.5 text-foreground" />}
                    </button>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer text-xs">
                  <Shapes className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Estilo</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover border-border">
                  {SHAPES.map((sh) => (
                    <DropdownMenuItem
                      key={sh}
                      onClick={() => onUpdate(node.id, { shape: sh })}
                      className={cn("capitalize cursor-pointer text-xs", node.shape === sh && "font-semibold text-primary")}
                    >
                      {sh === "card" && "Tarjeta"}
                      {sh === "rounded" && "Redondeado"}
                      {sh === "pill" && "Píldora"}
                      {sh === "rectangle" && "Rectángulo"}
                      {sh === "sticky" && "Nota"}
                      {sh === "circle" && "Círculo"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                onClick={() => setShowChecklistInput(true)}
                className="gap-2 cursor-pointer text-xs"
              >
                <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Añadir Checklist</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onExportToTask(node.id)}
                className="gap-2 cursor-pointer text-xs text-emerald-600 dark:text-emerald-400"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Convertir a Tarea</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDelete(node.id)}
                className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
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
            className="w-full bg-background text-foreground px-2 py-1 text-xs rounded border border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          />
          <button
            type="button"
            onClick={handleSaveLabel}
            className="p-1 rounded text-primary hover:bg-accent"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <h4
          className={cn(
            "font-medium leading-snug break-words tracking-tight text-foreground",
            node.fontSize === "xl" && "text-base font-bold",
            node.fontSize === "lg" && "text-sm font-semibold",
            (!node.fontSize || node.fontSize === "base") && "text-xs font-medium",
            node.fontSize === "sm" && "text-[11px]"
          )}
        >
          {node.label}
        </h4>
      )}

      {/* Node Description / Notes */}
      {node.description && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">
          {node.description}
        </p>
      )}

      {/* Checklist / Subtasks list in Node */}
      {node.checklist && node.checklist.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-border space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Progreso</span>
            <span className="font-mono text-[9px]">{completedCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-0.5 mt-1 max-h-28 overflow-y-auto pr-1">
            {node.checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-1.5 text-xs group/item hover:bg-accent/40 px-1 py-0.5 rounded transition-colors"
                onClick={(e) => handleToggleChecklist(item.id, e)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                  {item.completed ? (
                    <CheckSquare className="w-3 h-3 text-primary shrink-0" />
                  ) : (
                    <Square className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={cn(
                      "truncate text-[11px]",
                      item.completed ? "line-through text-muted-foreground/70" : "text-foreground"
                    )}
                  >
                    {item.text}
                  </span>
                </div>
                <button
                  type="button"
                  className="opacity-0 group-hover/item:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={(e) => handleDeleteChecklistItem(item.id, e)}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline add checklist item input */}
      {showChecklistInput && (
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Nueva subtarea..."
            value={newChecklistText}
            onChange={(e) => setNewChecklistText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddChecklistItem();
              if (e.key === "Escape") setShowChecklistInput(false);
            }}
            className="w-full bg-background text-foreground text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:border-primary"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddChecklistItem}
            className="p-1 text-primary hover:bg-accent rounded"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
