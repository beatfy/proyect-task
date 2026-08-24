"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MindMapData,
  MindMapNode as NodeData,
  MindMapEdge,
  MindMapViewport,
} from "@/lib/types/mindmap";
import { MindMapNode } from "./MindMapNode";
import { cn } from "@/lib/utils";

interface MindMapCanvasProps {
  data: MindMapData;
  onChange: (data: MindMapData) => void;
  onExportToTask: (nodeId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  readOnly?: boolean;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  data,
  onChange,
  onExportToTask,
  selectedNodeId,
  onSelectNode,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport State
  const [viewport, setViewport] = useState<MindMapViewport>(
    data.viewport || { x: 0, y: 0, zoom: 1 }
  );

  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Wire Connection
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // History for Undo / Redo
  const [history, setHistory] = useState<MindMapData[]>([data]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Sync viewport updates
  useEffect(() => {
    if (
      data.viewport &&
      (data.viewport.x !== viewport.x ||
        data.viewport.y !== viewport.y ||
        data.viewport.zoom !== viewport.zoom)
    ) {
      setViewport(data.viewport);
    }
  }, [data.viewport]);

  // Push state to undo/redo history
  const pushHistory = useCallback(
    (newData: MindMapData) => {
      setHistory((prev) => {
        const updated = prev.slice(0, historyIndex + 1);
        return [...updated, newData];
      });
      setHistoryIndex((prev) => prev + 1);
      onChange(newData);
    },
    [historyIndex, onChange]
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onChange(history[prevIndex]);
    }
  }, [historyIndex, history, onChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onChange(history[nextIndex]);
    }
  }, [historyIndex, history, onChange]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        setIsSpacePressed(true);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }

      if (selectedNodeId) {
        if (e.key === "Tab") {
          e.preventDefault();
          handleAddChild(selectedNodeId);
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleAddSibling(selectedNodeId);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleDeleteNode(selectedNodeId);
        } else if (e.key === "Escape") {
          onSelectNode(null);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeId, undo, redo]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      e.button === 1 ||
      isSpacePressed ||
      e.target === containerRef.current ||
      (e.target as HTMLElement).id === "canvas-grid"
    ) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasCoords = screenToCanvas(e.clientX, e.clientY);
    setMousePos(canvasCoords);

    if (isPanning) {
      const newVp = {
        ...viewport,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      setViewport(newVp);
      onChange({ ...data, viewport: newVp });
    } else if (draggingNodeId) {
      const newNodes = data.nodes.map((node) => {
        if (node.id === draggingNodeId) {
          return {
            ...node,
            x: Math.round(canvasCoords.x - dragOffset.x),
            y: Math.round(canvasCoords.y - dragOffset.y),
          };
        }
        return node;
      });
      onChange({ ...data, nodes: newNodes });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggingNodeId) {
      setDraggingNodeId(null);
      pushHistory(data);
    }
    if (connectingSourceId) {
      setConnectingSourceId(null);
    }
  };

  // Zoom Handler with Mouse Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = 1.08;
    const newZoom = e.deltaY < 0 ? viewport.zoom * zoomFactor : viewport.zoom / zoomFactor;
    const clampedZoom = Math.min(Math.max(newZoom, 0.2), 2.5);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - viewport.x) * (clampedZoom / viewport.zoom);
    const newY = mouseY - (mouseY - viewport.y) * (clampedZoom / viewport.zoom);

    const newVp = { x: newX, y: newY, zoom: clampedZoom };
    setViewport(newVp);
    onChange({ ...data, viewport: newVp });
  };

  // Node Update
  const handleUpdateNode = (nodeId: string, updates: Partial<NodeData>) => {
    const newNodes = data.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n));
    const newData = { ...data, nodes: newNodes };
    pushHistory(newData);
  };

  // Add Child Node
  const handleAddChild = (
    parentNodeId: string,
    direction: "right" | "left" | "bottom" | "top" = "right"
  ) => {
    const parentNode = data.nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) return;

    const newId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const siblingCount = data.edges.filter((e) => e.source === parentNodeId).length;

    let x = parentNode.x + 250;
    let y = parentNode.y + siblingCount * 80;

    if (direction === "bottom") {
      x = parentNode.x + (siblingCount - 1) * 120;
      y = parentNode.y + 150;
    } else if (direction === "left") {
      x = parentNode.x - 250;
      y = parentNode.y + siblingCount * 80;
    } else if (direction === "top") {
      x = parentNode.x + (siblingCount - 1) * 120;
      y = parentNode.y - 150;
    }

    const newNode: NodeData = {
      id: newId,
      label: "Nueva Idea",
      x,
      y,
      parentId: parentNodeId,
      color: parentNode.color || "default",
      shape: "card",
    };

    const newEdge: MindMapEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: parentNodeId,
      target: newId,
      style: "curved",
    };

    const newData: MindMapData = {
      ...data,
      nodes: [...data.nodes, newNode],
      edges: [...data.edges, newEdge],
    };

    pushHistory(newData);
    onSelectNode(newId);
  };

  // Add Sibling Node
  const handleAddSibling = (nodeId: string) => {
    const currentNode = data.nodes.find((n) => n.id === nodeId);
    if (!currentNode || currentNode.isRoot) {
      handleAddChild(nodeId);
      return;
    }

    const parentId = currentNode.parentId;
    const newId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNode: NodeData = {
      id: newId,
      label: "Nueva Idea",
      x: currentNode.x,
      y: currentNode.y + 90,
      parentId: parentId || null,
      color: currentNode.color || "default",
      shape: currentNode.shape || "card",
    };

    const newEdges = [...data.edges];
    if (parentId) {
      newEdges.push({
        id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        source: parentId,
        target: newId,
        style: "curved",
      });
    }

    const newData: MindMapData = {
      ...data,
      nodes: [...data.nodes, newNode],
      edges: newEdges,
    };

    pushHistory(newData);
    onSelectNode(newId);
  };

  // Delete Node & connected edges
  const handleDeleteNode = (nodeId: string) => {
    const nodeToDelete = data.nodes.find((n) => n.id === nodeId);
    if (nodeToDelete?.isRoot && data.nodes.length === 1) return;

    const getDescendants = (id: string): string[] => {
      const children = data.edges.filter((e) => e.source === id).map((e) => e.target);
      return [id, ...children.flatMap(getDescendants)];
    };

    const allToDelete = new Set(getDescendants(nodeId));

    const newNodes = data.nodes.filter((n) => !allToDelete.has(n.id));
    const newEdges = data.edges.filter(
      (e) => !allToDelete.has(e.source) && !allToDelete.has(e.target)
    );

    const newData = { ...data, nodes: newNodes, edges: newEdges };
    pushHistory(newData);
    onSelectNode(null);
  };

  // Connection Drag Handlers
  const handleStartConnect = (nodeId: string, e: React.MouseEvent) => {
    setConnectingSourceId(nodeId);
    const canvasCoords = screenToCanvas(e.clientX, e.clientY);
    setMousePos(canvasCoords);
  };

  const handleEndConnect = (targetNodeId: string) => {
    if (connectingSourceId && connectingSourceId !== targetNodeId) {
      const edgeExists = data.edges.some(
        (e) =>
          (e.source === connectingSourceId && e.target === targetNodeId) ||
          (e.source === targetNodeId && e.target === connectingSourceId)
      );

      if (!edgeExists) {
        const newEdge: MindMapEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          source: connectingSourceId,
          target: targetNodeId,
          style: "curved",
        };
        const newData = {
          ...data,
          edges: [...data.edges, newEdge],
        };
        pushHistory(newData);
      }
    }
    setConnectingSourceId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0 || isSpacePressed) return;
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const canvasCoords = screenToCanvas(e.clientX, e.clientY);
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: canvasCoords.x - node.x,
      y: canvasCoords.y - node.y,
    });
  };

  // Collapse / Expand toggle
  const handleToggleCollapse = (nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    handleUpdateNode(nodeId, { collapsed: !node.collapsed });
  };

  // Check hidden nodes
  const isNodeHidden = (node: NodeData): boolean => {
    let currParentId = node.parentId;
    while (currParentId) {
      const parent = data.nodes.find((n) => n.id === currParentId);
      if (parent?.collapsed) return true;
      currParentId = parent?.parentId;
    }
    return false;
  };

  // Calculate Bezier path
  const calculateEdgePath = (sourceNode: NodeData, targetNode: NodeData) => {
    const sWidth = sourceNode.width || 190;
    const sHeight = sourceNode.height || 65;
    const tWidth = targetNode.width || 190;
    const tHeight = targetNode.height || 65;

    const isTargetRight = targetNode.x >= sourceNode.x;

    const startX = isTargetRight ? sourceNode.x + sWidth : sourceNode.x;
    const startY = sourceNode.y + sHeight / 2;

    const endX = isTargetRight ? targetNode.x : targetNode.x + tWidth;
    const endY = targetNode.y + tHeight / 2;

    const deltaX = Math.abs(endX - startX);
    const controlPointOffset = Math.max(deltaX * 0.5, 40);

    const cp1X = isTargetRight ? startX + controlPointOffset : startX - controlPointOffset;
    const cp1Y = startY;
    const cp2X = isTargetRight ? endX - controlPointOffset : endX + controlPointOffset;
    const cp2Y = endY;

    return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
  };

  const connectingSourceNode = connectingSourceId
    ? data.nodes.find((n) => n.id === connectingSourceId)
    : null;

  return (
    <div
      ref={containerRef}
      id="canvas-grid"
      className={cn(
        "relative w-full h-full overflow-hidden select-none bg-background text-foreground",
        isSpacePressed || isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      )}
      style={{
        backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        color: "hsl(var(--muted-foreground) / 0.15)",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => onSelectNode(null)}
    >
      {/* Zoom / Canvas Transform Container */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* SVG Edges Layer */}
        <svg className="absolute inset-0 w-[50000px] h-[50000px] -translate-x-[25000px] -translate-y-[25000px] overflow-visible pointer-events-none">
          {data.edges.map((edge) => {
            const source = data.nodes.find((n) => n.id === edge.source);
            const target = data.nodes.find((n) => n.id === edge.target);

            if (!source || !target || isNodeHidden(source) || isNodeHidden(target)) {
              return null;
            }

            const path = calculateEdgePath(source, target);
            const isHighlighted =
              selectedNodeId === edge.source || selectedNodeId === edge.target;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHighlighted ? 2.5 : 1.75}
                  strokeDasharray={edge.animated ? "4,4" : undefined}
                  className="transition-colors duration-200"
                />
              </g>
            );
          })}

          {/* Active Live Wire Connection preview */}
          {connectingSourceNode && (
            <path
              d={`M ${connectingSourceNode.x + 190} ${connectingSourceNode.y + 32} Q ${
                (connectingSourceNode.x + 190 + mousePos.x) / 2
              } ${(connectingSourceNode.y + 32 + mousePos.y) / 2} ${mousePos.x} ${mousePos.y}`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="4,4"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 pointer-events-auto">
          {data.nodes.map((node) => {
            if (isNodeHidden(node)) return null;

            const isSelected = selectedNodeId === node.id;
            const hasChildren = data.edges.some((e) => e.source === node.id);

            return (
              <div key={node.id} onMouseDown={(e) => handleNodeMouseDown(node.id, e)}>
                <MindMapNode
                  node={node}
                  isSelected={isSelected}
                  hasChildren={hasChildren}
                  isConnectingSource={connectingSourceId === node.id}
                  onSelect={(id) => onSelectNode(id)}
                  onUpdate={handleUpdateNode}
                  onDelete={handleDeleteNode}
                  onAddChild={handleAddChild}
                  onAddSibling={handleAddSibling}
                  onStartConnect={handleStartConnect}
                  onEndConnect={handleEndConnect}
                  onExportToTask={onExportToTask}
                  onToggleCollapse={handleToggleCollapse}
                  zoom={viewport.zoom}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
