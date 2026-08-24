export type NodeShape =
  | "rounded"
  | "pill"
  | "rectangle"
  | "circle"
  | "card"
  | "sticky"
  | "cloud";

export type NodeColor =
  | "indigo"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "cyan"
  | "slate"
  | "orange";

export type EdgeStyle = "curved" | "straight" | "orthogonal";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  shape?: NodeShape;
  color?: NodeColor;
  icon?: string;
  isRoot?: boolean;
  parentId?: string | null;
  collapsed?: boolean;
  checklist?: ChecklistItem[];
  tags?: string[];
  priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  taskId?: string | null;
  taskTitle?: string | null;
  url?: string;
  fontSize?: "sm" | "base" | "lg" | "xl";
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: EdgeStyle;
  color?: string;
  animated?: boolean;
  arrow?: boolean;
}

export interface MindMapViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  viewport: MindMapViewport;
  grid?: boolean;
  theme?: "modern" | "dark" | "pastel" | "cyberpunk" | "minimal";
}

export interface MindMapRecord {
  id: string;
  title: string;
  description: string | null;
  data: MindMapData;
  userId: string;
  projectId: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
  isFavorite: boolean;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}
