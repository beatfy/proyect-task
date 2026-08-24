"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, MoreHorizontal, User, Pencil, Trash2, FolderOpen, LayoutGrid, List, Table, Calendar, MessageSquare, Paperclip, ChevronDown, ChevronUp, X, Upload, File, Image, FileText, Timer, Play, Square, LayoutTemplate, Download, Share2, Maximize2, Clock, CheckCircle2, Circle, AlertCircle, Copy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/lib/organization-context";
import { Building2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  assignee?: { id: string; name: string | null; email: string; image?: string | null } | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  parentId?: string | null;
  createdAt?: string | null;
  creatorId?: string | null;
  creator?: { id: string; name: string | null; email: string; image?: string | null } | null;
  pipelineId?: string | null;
  stageId?: string | null;
  stage?: { id: string; name: string; color: string; position: number } | null;
}

interface TaskPipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
}

interface TaskPipeline {
  id: string;
  name: string;
  isDefault: boolean;
  projectId: string | null;
  organizationId: string | null;
  stages: TaskPipelineStage[];
}

interface Subtask extends Task {}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string; image?: string | null };
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  tags: string[] | null;
  isDefault: boolean;
}

interface TimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
}

const columns = [
  { id: "TODO", title: "Por hacer", color: "bg-slate-500" },
  { id: "INPROGRESS", title: "En progreso", color: "bg-blue-500" },
  { id: "INREVIEW", title: "En revisión", color: "bg-yellow-500" },
  { id: "DONE", title: "Hecho", color: "bg-green-500" },
];

const priorityColors: Record<string, string> = {
  NONE: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  LOW: "bg-muted text-slate-600 dark:text-muted-foreground border-border",
  MEDIUM: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  HIGH: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  URGENT: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const statusColors: Record<string, string> = {
  TODO: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  INPROGRESS: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  INREVIEW: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  DONE: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
};

type ViewType = "kanban" | "list" | "table";

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
}

function DraggableTaskCard({ task, onOpenDetail, onEdit, onDelete }: { task: Task; onOpenDetail: () => void; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
  const style = { transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined, transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onOpenDetail} className="cursor-pointer hover:shadow-md transition-shadow bg-card border-border">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm leading-tight text-foreground">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-border">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {task.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {task.priority !== "NONE" && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 border", priorityColors[task.priority as keyof typeof priorityColors])}>
              {priorityLabels[task.priority as keyof typeof priorityLabels]}
            </Badge>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { Suspense } from "react";

function TasksPageContent() {
  const { organizations, selectedOrg, setSelectedOrg, loading: orgLoading } = useOrganization();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>(typeof window !== 'undefined' && window.innerWidth < 768 ? "list" : "kanban");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState("NONE");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [projectMembers, setProjectMembers] = useState<{id:string; role:string; user:{id:string; name:string|null; email:string; image:string|null}}[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic Pipeline States
  const [pipelines, setPipelines] = useState<TaskPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [pipelineSettingsOpen, setPipelineSettingsOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [editPipelineName, setEditPipelineName] = useState("");
  const [editPipelineStages, setEditPipelineStages] = useState<TaskPipelineStage[]>([]);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(true);

  // Detail panel states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [detailProjectMembers, setDetailProjectMembers] = useState<{id:string; role:string; user:{id:string; name:string|null; email:string; image:string|null}}[]>([]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Timer
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  const searchParams = useSearchParams();

  const fetchPipelines = useCallback(async (projId?: string) => {
    try {
      const params = new URLSearchParams();
      const actualProj = projId !== undefined ? projId : filterProject;
      if (actualProj && actualProj !== "all") {
        params.set("projectId", actualProj);
      } else if (selectedOrg && selectedOrg !== "all") {
        params.set("organizationId", selectedOrg);
      }
      const res = await fetch(`/api/tasks/pipelines?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPipelines(data);
        if (data.length > 0) {
          const activeId = data.some((p: any) => p.id === selectedPipelineId) 
            ? selectedPipelineId 
            : data[0].id;
          setSelectedPipelineId(activeId);
        }
      }
    } catch {}
  }, [selectedOrg, selectedPipelineId, filterProject]);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchTemplates();
    fetchActiveTimer();
    fetchPipelines();
  }, [selectedOrg]);

  // When project filter changes, reload pipelines
  useEffect(() => {
    fetchPipelines(filterProject);
  }, [filterProject]);

  // Auto-open task from URL param & set project filter from URL
  useEffect(() => {
    const openTaskId = searchParams.get('openTask');
    const projectFilter = searchParams.get('project');
    if (projectFilter) setFilterProject(projectFilter);
    if (openTaskId && tasks.length > 0 && !detailOpen) {
      const task = tasks.find(t => t.id === openTaskId);
      if (task) handleOpenDetail(task);
    }
  }, [searchParams, tasks]);

  // Fetch members when project changes
  useEffect(() => {
    if (projectId && projectId !== "none") {
      fetch(`/api/projects/${projectId}/members`)
        .then(r => r.ok ? r.json() : [])
        .then(setProjectMembers)
        .catch(() => setProjectMembers([]));
    } else {
      setProjectMembers([]);
    }
    setAssigneeIds([]);
  }, [projectId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {}
  };

  const fetchActiveTimer = async () => {
    try {
      const res = await fetch("/api/time-entries?userId=me");
      if (res.ok) {
        const entries: TimeEntry[] = await res.json();
        const running = entries.find((e) => !e.endTime);
        if (running) {
          setActiveTimer(running);
          const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
          setTimerSeconds(elapsed);
        }
        setTimeEntries(entries.filter((e) => e.endTime));
      }
    } catch {}
  };

  // Timer tick
  useEffect(() => {
    if (activeTimer) {
      timerInterval.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
      setTimerSeconds(0);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [activeTimer]);

  const handleStartTimer = async (taskId: string) => {
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "start" }),
      });
      if (res.ok) {
        const entry = await res.json();
        setActiveTimer(entry);
        setTimerSeconds(0);
        toast.success("Timer iniciado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al iniciar timer");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeTimer.id, action: "stop" }),
      });
      if (res.ok) {
        const stopped = await res.json();
        setTimeEntries([stopped, ...timeEntries]);
        setActiveTimer(null);
        setTimerSeconds(0);
        toast.success(`Timer detenido — ${formatTimer(stopped.duration || 0)}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al detener timer");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const applyTemplate = (tmpl: TaskTemplate) => {
    setTitle(tmpl.title);
    setDescription(tmpl.description || "");
    setStatus(tmpl.status);
    setPriority(tmpl.priority);
    setTemplatesOpen(false);
    setOpen(true);
    toast.success(`Template "${tmpl.name}" aplicado`);
  };

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      const response = await fetch(`/api/tasks?${params}`);
      if (response.status === 401) {
        setTasks([]);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setTasks(data.filter((t: Task) => !t.parentId));
      }
    } catch {
      console.error("Error loading tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);
      const response = await fetch(`/api/projects?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch {}
  };

  const fetchTaskDetails = async (taskId: string) => {
    const subRes = await fetch(`/api/tasks?parentId=${taskId}`);
    if (subRes.ok) setSubtasks(await subRes.json());

    const comRes = await fetch(`/api/comments?taskId=${taskId}`);
    if (comRes.ok) setComments(await comRes.json());

    const attRes = await fetch(`/api/attachments?taskId=${taskId}`);
    if (attRes.ok) setAttachments(await attRes.json());

    // Fetch time entries for this task
    try {
      const teRes = await fetch(`/api/time-entries?taskId=${taskId}`);
      if (teRes.ok) {
        const entries: TimeEntry[] = await teRes.json();
        setTimeEntries(entries.filter((e) => e.endTime));
        const running = entries.find((e) => !e.endTime);
        if (running) {
          setActiveTimer(running);
          const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
          setTimerSeconds(elapsed);
        }
      }
    } catch {}
  };

  const fallbackStages = [
    { id: "TODO", name: "Por hacer", color: "#64748b", position: 0 },
    { id: "INPROGRESS", name: "En progreso", color: "#3b82f6", position: 1 },
    { id: "INREVIEW", name: "En revisión", color: "#eab308", position: 2 },
    { id: "DONE", name: "Hecho", color: "#22c55e", position: 3 },
  ];

  const activePipeline = pipelines.find(p => p.id === selectedPipelineId) || pipelines[0];
  const activeStages = activePipeline?.stages || [];
  const stagesToRender = activeStages.length > 0 ? activeStages : fallbackStages;

  const getStageBadgeStyle = (color: string) => {
    return {
      backgroundColor: `${color}15`,
      borderColor: `${color}30`,
      color: color,
    };
  };

  const isTaskInStage = (task: Task, stageId: string, allStages: TaskPipelineStage[]) => {
    if (task.stageId === stageId) return true;
    if (task.stageId && allStages.some(s => s.id === task.stageId)) {
      return false;
    }
    const columnIndex = allStages.findIndex(s => s.id === stageId);
    if (columnIndex === -1) return false;
    
    const taskStatusUpper = (task.status || "TODO").toUpperCase();
    if (taskStatusUpper === "TODO" && columnIndex === 0) return true;
    if (taskStatusUpper === "INPROGRESS" && columnIndex === 1) return true;
    if (taskStatusUpper === "INREVIEW" && columnIndex === 2) return true;
    if (taskStatusUpper === "DONE" && columnIndex === (allStages.length - 1)) return true;
    
    if (columnIndex === 0 && !["INPROGRESS", "INREVIEW", "DONE"].includes(taskStatusUpper)) {
      return true;
    }
    return false;
  };

  const getTasksByStage = (stageId: string) => {
    return filteredTasks.filter(t => isTaskInStage(t, stageId, stagesToRender));
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus(stagesToRender[0]?.id || "TODO");
    setStageId(stagesToRender[0]?.id || "TODO");
    setPriority("NONE");
    setDueDate("");
    setAssignedTo("");
    setProjectId("none");
    setAssigneeIds([]);
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getMemberName = (userId: string) => {
    const m = projectMembers.find(m => m.user.id === userId);
    return m ? (m.user.name || m.user.email) : userId;
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, 
          status: stageId || status || stagesToRender[0]?.id || "TODO", 
          priority,
          dueDate: dueDate || null,
          assignedTo: assignedTo || null, projectId: projectId === "none" ? null : projectId || null,
          assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
          pipelineId: activePipeline?.id || null,
          stageId: stageId || stagesToRender[0]?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear tarea");
        return;
      }

      setTasks([data, ...tasks]);
      resetForm();
      setOpen(false);
      toast.success("Tarea creada");
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setStageId(task.stageId || task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setAssignedTo(task.assignedTo || "");
    setProjectId(task.projectId || "none");
    setEditOpen(true);
  };

  const handleOpenDetail = (task: Task) => {
    setDetailTask(task);
    setDetailOpen(true);
    setDetailTitle(task.title);
    setDetailDescription(task.description || "");
    setEditingTitle(false);
    setEditingDescription(false);
    setCollapsedSections({});
    setActiveField(null);
    fetchTaskDetails(task.id);
    if (task.projectId) {
      fetch(`/api/projects/${task.projectId}/members`)
        .then(r => r.ok ? r.json() : [])
        .then(setDetailProjectMembers)
        .catch(() => setDetailProjectMembers([]));
    } else {
      setDetailProjectMembers([]);
    }
  };

  const handleUpdate = async () => {
    if (!editingTask || !title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id, title, description, 
          status: stageId || status, 
          priority,
          dueDate: dueDate || null,
          assignedTo: assignedTo || null, projectId: projectId === "none" ? null : projectId || null,
          pipelineId: activePipeline?.id || null,
          stageId: stageId || null,
        }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map(t => t.id === editingTask.id ? updatedTask : t));
        resetForm();
        setEditOpen(false);
        setEditingTask(null);
        toast.success("Tarea actualizada");
      }
    } catch {
      toast.error("Error al actualizar tarea");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta tarea?")) return;

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
        toast.success("Tarea eliminada");
      } else {
        const data = await response.json();
        toast.error(data.error || "Error al eliminar tarea");
      }
    } catch {
      toast.error("Error al eliminar tarea");
    }
  };

  const handleCreateSubtask = async () => {
    if (!subtaskTitle.trim() || !detailTask) {
      toast.error("El título es requerido");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subtaskTitle,
          parentId: detailTask.id,
          projectId: detailTask.projectId
        })
      });

      if (res.ok) {
        const subtask = await res.json();
        setSubtasks([...subtasks, subtask]);
        setSubtaskTitle("");
        toast.success("Subtarea creada");
      }
    } catch {
      toast.error("Error al crear subtarea");
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    const newStatus = subtask.status === "DONE" ? "TODO" : "DONE";
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subtask.id, status: newStatus })
      });
      if (response.ok) {
        setSubtasks(subtasks.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s));
      } else {
        const data = await response.json();
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !detailTask) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: detailTask.id, content: newComment })
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment("");
      }
    } catch {
      toast.error("Error al añadir comentario");
    }
  };

  const MAX_CLIENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB (imágenes se comprimen antes)
  const COMPRESS_THRESHOLD = 4 * 1024 * 1024; // Comprimir si es mayor a 4MB

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !detailTask) return;

    // Validación client-side de tamaño (antes de comprimir)
    if (rawFile.size > MAX_CLIENT_FILE_SIZE) {
      toast.error(`El archivo supera el límite de 10MB (${(rawFile.size / 1024 / 1024).toFixed(1)}MB). Reduce el tamaño o comprime la imagen.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      // Comprimir imagen si es grande
      let fileToUpload = rawFile;
      if (rawFile.type.startsWith("image/") && rawFile.size > COMPRESS_THRESHOLD) {
        try {
          const { compressImageIfNeeded } = await import("@/lib/image-compress");
          fileToUpload = await compressImageIfNeeded(rawFile, {
            maxDimension: 1920,
            quality: 0.8,
            maxFileSize: COMPRESS_THRESHOLD,
          });
        } catch {
          // Si la compresión falla, subir original si cabe
          if (rawFile.size > 4 * 1024 * 1024) {
            toast.error("No se pudo comprimir la imagen. Intenta con una imagen más pequeña.");
            setUploading(false);
            e.target.value = "";
            return;
          }
        }
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("taskId", detailTask.id);

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const att = await res.json();
        setAttachments([...attachments, att]);
        toast.success("Archivo subido");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al subir archivo");
      }
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      setAttachments(attachments.filter(a => a.id !== id));
      toast.success("Archivo eliminado");
    } catch {
      toast.error("Error al eliminar archivo");
    }
  };

  const dndHandleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setDraggedTask(task);
  };

  const dndHandleDragOver = () => {
    // Do not call setTasks during onDragOver to prevent React error #185 (Maximum update depth exceeded)
  };

  const dndHandleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const originalTask = draggedTask;
    setDraggedTask(null);

    if (!over || !originalTask) return;

    let targetStageId: string | null = null;
    for (const stage of stagesToRender) {
      if (
        stage.id === over.id ||
        tasks.some(t => t.id === over.id && isTaskInStage(t, stage.id, stagesToRender))
      ) {
        targetStageId = stage.id;
        break;
      }
    }

    if (!targetStageId) return;

    const currentStage = stagesToRender.find(s => isTaskInStage(originalTask, s.id, stagesToRender));
    const currentStageId = currentStage ? currentStage.id : (originalTask.stageId || originalTask.status);

    if (targetStageId !== currentStageId) {
      // Optimistic update
      setTasks(prev =>
        prev.map(t =>
          t.id === active.id
            ? { ...t, stageId: targetStageId!, status: targetStageId! }
            : t
        )
      );

      try {
        const response = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: active.id, 
            stageId: targetStageId,
            status: targetStageId
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Error al mover tarea");
          fetchTasks();
        } else {
          toast.success("Tarea movida");
        }
      } catch {
        toast.error("Error al mover tarea");
        fetchTasks();
      }
    }
  };

  const filteredTasks = filterProject === "all" ? tasks : tasks.filter(t => t.projectId === filterProject);
  const getProjectName = (id: string | null) => {
    if (!id) return null;
    return projects.find(p => p.id === id)?.name || null;
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalTaskTime = timeEntries
    .filter((e) => detailTask && e.taskId === detailTask.id)
    .reduce((sum, e) => sum + (e.duration || 0), 0);

  const autoSaveField = async (field: string, value: string | null) => {
    if (!detailTask) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detailTask.id, [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetailTask(updated);
        setTasks(tasks.map(t => t.id === updated.id ? updated : t));
        toast.success("Guardado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error al guardar");
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getTaskIdentifier = (task: Task | null) => {
    if (!task) return "";
    if (task.project?.name) {
      const prefix = task.project.name.substring(0, 4).toUpperCase().replace(/\s/g, "");
      const num = task.id.substring(0, 4).toUpperCase();
      return `${prefix}-${num}`;
    }
    return `TASK-${task.id.substring(0, 4).toUpperCase()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tareas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestiona todas tus tareas</p>
          </div>
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Nueva Tarea</span><span className="sm:hidden">+</span>
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile view selector - dropdown */}
          <Select value={view} onValueChange={(v: ViewType) => setView(v)}>
            <SelectTrigger className="w-[140px] md:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-border">
              <SelectItem value="kanban">Kanban</SelectItem>
              <SelectItem value="table">Tabla</SelectItem>
              <SelectItem value="list">Lista</SelectItem>
            </SelectContent>
          </Select>

          {/* Desktop view selector - buttons */}
          <div className="hidden md:flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-border">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")} className="h-8 px-3">
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="h-8 px-3">
              <Table className="h-4 w-4 mr-1" /> Tabla
            </Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")} className="h-8 px-3">
              <List className="h-4 w-4 mr-1" /> Lista
            </Button>
          </div>

          {/* Pipeline Selector and Settings */}
          {pipelines.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg p-1 border border-border">
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="w-[180px] h-8 border-0 bg-transparent text-sm font-medium focus:ring-0">
                  <SelectValue placeholder="Seleccionar tablero" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-border">
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  const active = pipelines.find(p => p.id === selectedPipelineId) || pipelines[0];
                  if (active) {
                    setEditPipelineName(active.name);
                    setEditPipelineStages([...active.stages]);
                  }
                  setPipelineSettingsOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )}

          {/* Templates Dropdown - Desktop only */}
          <DropdownMenu open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DropdownMenuTrigger asChild className="hidden md:flex">
              <Button variant="outline" className="border-border dark:text-slate-300">
                <LayoutTemplate className="h-4 w-4 mr-2" /> Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-border w-56">
              {templates.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground dark:text-slate-500">
                  No hay templates
                </DropdownMenuItem>
              ) : (
                templates.map((tmpl) => (
                  <DropdownMenuItem
                    key={tmpl.id}
                    onClick={() => applyTemplate(tmpl)}
                    className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="text-xs text-muted-foreground dark:text-slate-500 truncate max-w-[200px]">{tmpl.title}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px] border-border dark:text-slate-300">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-border">
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {organizations.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-[200px] border-border dark:text-slate-300">
                  <SelectValue placeholder="Filtrar por organización" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-border">
                  <SelectItem value="all">Todas</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-border dark:text-slate-300 hidden sm:flex" disabled={!projectId || projectId === "none"}>
                <Download className="h-4 w-4 mr-2" /> <span className="hidden md:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-border">
              <DropdownMenuItem onClick={() => window.open(`/api/tasks/export?projectId=${projectId}&format=csv`)} className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/tasks/export?projectId=${projectId}&format=pdf`)} className="cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-white dark:bg-slate-900 border-border max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Crear Tarea</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Título</Label>
              <Input
                placeholder="Título de la tarea"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-border">
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Estado</Label>
                <Select value={stageId || status} onValueChange={(val) => { setStageId(val); setStatus(val); }}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-border">
                    {stagesToRender.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span>{stage.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-border">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
            <div className="space-y-2" ref={assigneeDropdownRef}>
              <Label className="text-slate-700 dark:text-slate-300">Asignar usuario</Label>
              {projectMembers.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                    className="flex items-center justify-between w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-foreground hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <span className="truncate">
                      {assigneeIds.length === 0
                        ? "Seleccionar asignados..."
                        : assigneeIds.length === 1
                        ? getMemberName(assigneeIds[0])
                        : `${assigneeIds.length} asignados`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", assigneeDropdownOpen && "rotate-180")} />
                  </button>
                  {assigneeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assigneeIds.map(uid => (
                        <Badge key={uid} variant="secondary" className="gap-1 pr-1 border bg-neutral-50 dark:bg-neutral-900/10 text-neutral-800 dark:text-neutral-400 border-indigo-200 dark:border-neutral-800">
                          {getMemberName(uid)}
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleAssignee(uid); }} className="ml-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {assigneeDropdownOpen && (
                    <div className="relative z-50 mt-1 w-full rounded-md border border-border bg-white dark:bg-slate-900 shadow-lg max-h-60 overflow-y-auto">
                      {projectMembers.map((m) => (
                        <label key={m.user.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assigneeIds.includes(m.user.id)}
                            onChange={() => toggleAssignee(m.user.id)}
                            className="rounded border-slate-300 text-neutral-900 focus:ring-neutral-900"
                          />
                          <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                            {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">{m.user.name || m.user.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Input
                  placeholder="Selecciona un proyecto primero"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
                />
              )}
            </div>
          </div>
          <div className="flex-shrink-0 pt-4">
            <Button onClick={handleCreate} className="w-full">
              Crear Tarea
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { resetForm(); setEditingTask(null); }}}>
        <DialogContent className="bg-white dark:bg-slate-900 border-border max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Editar Tarea</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Título</Label>
              <Input
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Descripción</Label>
              <Input
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Estado</Label>
                <Select value={stageId || status} onValueChange={(val) => { setStageId(val); setStatus(val); }}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-border">
                    {stagesToRender.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span>{stage.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-border">
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Fecha de finalización</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>
          </div>
          <div className="flex-shrink-0 pt-4">
            <Button onClick={handleUpdate} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pipeline Settings Dialog */}
      <Dialog open={pipelineSettingsOpen} onOpenChange={setPipelineSettingsOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-border max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-foreground">Configurar Tablero y Columnas</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 pt-4 pr-1">
            {/* Rename pipeline */}
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Nombre del Tablero</Label>
              <Input
                value={editPipelineName}
                onChange={(e) => setEditPipelineName(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
              />
            </div>

            {/* Configure columns/stages */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-700 dark:text-slate-300 font-medium font-semibold">Columnas / Estados</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newStage: TaskPipelineStage = {
                      id: "",
                      name: `Nueva Columna`,
                      position: editPipelineStages.length,
                      color: "#6366f1",
                    };
                    setEditPipelineStages([...editPipelineStages, newStage]);
                  }}
                  className="h-8 border-border hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4 mr-1" /> Añadir Columna
                </Button>
              </div>

              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {editPipelineStages.map((stage, idx) => (
                  <div key={stage.id || idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-md border border-border">
                    <div className="flex flex-col">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const updated = [...editPipelineStages];
                          const temp = updated[idx];
                          updated[idx] = updated[idx - 1];
                          updated[idx - 1] = temp;
                          updated.forEach((s, i) => s.position = i);
                          setEditPipelineStages(updated);
                        }}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        disabled={idx === editPipelineStages.length - 1}
                        onClick={() => {
                          const updated = [...editPipelineStages];
                          const temp = updated[idx];
                          updated[idx] = updated[idx + 1];
                          updated[idx + 1] = temp;
                          updated.forEach((s, i) => s.position = i);
                          setEditPipelineStages(updated);
                        }}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    <Input
                      value={stage.name}
                      onChange={(e) => {
                        const updated = [...editPipelineStages];
                        updated[idx].name = e.target.value;
                        setEditPipelineStages(updated);
                      }}
                      className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground flex-1 h-8 text-sm"
                    />

                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => {
                        const updated = [...editPipelineStages];
                        updated[idx].color = e.target.value;
                        setEditPipelineStages(updated);
                      }}
                      className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 cursor-pointer p-0"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (editPipelineStages.length <= 1) {
                          toast.error("El tablero debe tener al menos una columna");
                          return;
                        }
                        const updated = editPipelineStages.filter((_, i) => i !== idx);
                        updated.forEach((s, i) => s.position = i);
                        setEditPipelineStages(updated);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Pipeline Section */}
            <div className="border-t border-border pt-4">
              <Label className="text-slate-700 dark:text-slate-300 block mb-2 font-semibold">Crear un Nuevo Tablero</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del nuevo tablero..."
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground flex-1"
                />
                <Button
                  onClick={async () => {
                    if (!newPipelineName.trim()) {
                      toast.error("El nombre es requerido");
                      return;
                    }
                    try {
                      const body: any = { name: newPipelineName.trim() };
                      if (filterProject && filterProject !== "all") {
                        body.projectId = filterProject;
                      } else if (selectedOrg && selectedOrg !== "all") {
                        body.organizationId = selectedOrg;
                      }
                      const res = await fetch("/api/tasks/pipelines", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      if (res.ok) {
                        const newPipe = await res.json();
                        setPipelines([...pipelines, newPipe]);
                        setSelectedPipelineId(newPipe.id);
                        setNewPipelineName("");
                        setPipelineSettingsOpen(false);
                        toast.success(`Tablero "${newPipe.name}" creado`);
                      } else {
                        const data = await res.json();
                        toast.error(data.error || "Error al crear tablero");
                      }
                    } catch {
                      toast.error("Error de conexión");
                    }
                  }}
                >
                  Crear
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 pt-4 border-t border-border flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("¿Estás seguro de eliminar todo este tablero de tareas? Esta acción es irreversible.")) return;
                try {
                  const res = await fetch(`/api/tasks/pipelines/${selectedPipelineId}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    toast.success("Tablero eliminado");
                    setPipelineSettingsOpen(false);
                    fetchPipelines();
                  } else {
                    const data = await res.json();
                    toast.error(data.error || "Error al eliminar tablero");
                  }
                } catch {
                  toast.error("Error de conexión");
                }
              }}
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 hover:border-red-300"
            >
              Eliminar Tablero
            </Button>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPipelineSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/tasks/pipelines/${selectedPipelineId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: editPipelineName,
                        stages: editPipelineStages,
                      }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setPipelines(pipelines.map((p) => p.id === updated.id ? updated : p));
                      setPipelineSettingsOpen(false);
                      toast.success("Tablero guardado");
                      fetchTasks();
                    } else {
                      const data = await res.json();
                      toast.error(data.error || "Error al guardar");
                    }
                  } catch {
                    toast.error("Error de conexión");
                  }
                }}
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog - Jira/Linear Style */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setDetailTask(null); setActiveTimer(null); setTimerSeconds(0); }}}>
        <DialogContent className="bg-white dark:bg-slate-900 border-border w-[90vw] max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground">TASK-{detailTask?.id?.slice(-5).toUpperCase()}</span>
              <Badge variant="secondary" className="text-[10px] border dark:border-slate-600">Tarea</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setDetailOpen(false); setDetailTask(null); setActiveTimer(null); setTimerSeconds(0); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left Column - Content (70%) */}
            <div className="flex-1 md:w-[70%] overflow-y-auto p-6 space-y-6">
              {/* Title - Inline Editable */}
              <h1
                contentEditable
                suppressContentEditableWarning
                className="text-2xl font-semibold text-foreground outline-none focus:ring-2 focus:ring-blue-500 focus:rounded px-1 -ml-1"
                onBlur={(e) => {
                  const newTitle = e.currentTarget.textContent?.trim() || "";
                  if (newTitle && newTitle !== detailTask?.title) {
                    autoSaveField("title", newTitle);
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
              >{detailTitle}</h1>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase proyectoing-wide">Descripción</label>
                <textarea
                  placeholder="Añadir descripción..."
                  value={detailDescription}
                  onChange={(e) => setDetailDescription(e.target.value)}
                  onBlur={() => {
                    if (detailDescription !== (detailTask?.description || "")) {
                      autoSaveField("description", detailDescription);
                    }
                  }}
                  rows={5}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Subtasks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowSubtasks(!showSubtasks)}>
                  <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", !showSubtasks && "-rotate-90")} />
                    Subtareas ({subtasks.length}){subtasks.length > 0 && (
                      <span className="text-xs text-muted-foreground">· {subtasks.filter(s => s.status === "DONE").length}/{subtasks.length} completadas</span>
                    )}
                  </h3>
                </div>
                {subtasks.length > 0 && (
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${subtasks.length > 0 ? (subtasks.filter(s => s.status === "DONE").length / subtasks.length * 100) : 0}%` }} />
                  </div>
                )}
                {showSubtasks && (
                  <div className="space-y-1">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 py-1 group">
                        <input type="checkbox" checked={st.status === "DONE"} onChange={() => handleToggleSubtask(st)} className="rounded-sm border-slate-300 dark:border-slate-600" />
                        <span className={cn("text-sm flex-1", st.status === "DONE" && "text-muted-foreground line-through dark:text-slate-500")}>{st.title}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={async () => {
                          await fetch(`/api/tasks?id=${st.id}`, { method: "DELETE" });
                          setSubtasks(subtasks.filter(s => s.id !== st.id));
                        }}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Input placeholder="Añadir subtarea..." value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground h-8 text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubtask(); }} />
                      {subtaskTitle.trim() && <Button size="sm" variant="ghost" onClick={handleCreateSubtask}>Añadir</Button>}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="space-y-3">
                <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentarios ({comments.length})
                </h3>
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                          {c.author.name?.[0]?.toUpperCase() || c.author.email[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.author.name || c.author.email}</span>
                        <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-muted-foreground pl-8">{c.content}</p>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2">
                    <textarea placeholder="Añadir comentario..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <Button size="sm" onClick={handleAddComment} className="self-end">Enviar</Button>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Archivos ({attachments.length})
                </h3>
                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {attachments.map((a) => (
                      a.type === "image" ? (
                        <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/attachments/${a.id}`} alt={a.name} className="w-full h-24 object-cover" />
                          <div className="p-1.5 text-xs text-slate-600 dark:text-muted-foreground truncate">{a.name}</div>
                        </a>
                      ) : (
                        <div key={a.id} className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border">
                          {a.type === "pdf" ? <FileText className="h-4 w-4 text-red-500" /> : <File className="h-4 w-4 text-slate-500" />}
                          <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-700 dark:text-slate-300 hover:underline truncate flex-1">{a.name}</a>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleDeleteAttachment(a.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></Button>
                        </div>
                      )
                    ))}
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" />
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span><Upload className="h-4 w-4 mr-2" />{uploading ? "Subiendo..." : "Subir archivo"}</span>
                  </Button>
                </label>
              </div>

              {/* Time Entries */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Tiempo{totalTaskTime > 0 && <span className="text-xs text-muted-foreground ml-1">· {formatTimer(totalTaskTime)}</span>}
                </h3>
                {timeEntries.filter((e) => detailTask && e.taskId === detailTask.id).length > 0 && (
                  <div className="space-y-1">
                    {timeEntries.filter((e) => detailTask && e.taskId === detailTask.id).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(entry.startTime).toLocaleString()}</span>
                        <span>→</span>
                        <span>{entry.endTime ? new Date(entry.endTime).toLocaleTimeString() : "..."}</span>
                        <Badge variant="secondary" className="text-[10px] border dark:border-slate-600">{formatTimer(entry.duration || 0)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Sidebar (30%) */}
            <div className="md:w-[30%] md:min-w-[250px] bg-card/50 border-t md:border-t-0 md:border-l border-border p-5 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select 
                  value={detailTask?.stageId || detailTask?.status || "TODO"} 
                  onValueChange={async (v) => {
                    await autoSaveField("stageId", v);
                    await autoSaveField("status", v);
                  }}
                >
                  <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-border">
                    {stagesToRender.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span>{stage.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
                <Select value={detailTask?.priority || "NONE"} onValueChange={(v) => autoSaveField("priority", v)}>
                  <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Asignado</label>
                <Select value={detailTask?.assignee?.id || "_none"} onValueChange={(v) => autoSaveField("assigneeId", v === "_none" ? null : v)}>
                  <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {detailProjectMembers.map((m) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-neutral-700 text-white flex items-center justify-center text-[10px]">
                            {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                          </div>
                          {m.user.name || m.user.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fecha límite</label>
                <Input
                  type="date"
                  value={detailTask?.dueDate ? new Date(detailTask.dueDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => autoSaveField("dueDate", e.target.value || null)}
                  className="w-full h-9 bg-white dark:bg-slate-900 border-border"
                />
              </div>

              {/* Project */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  {detailTask?.project?.name || "Sin proyecto"}
                </div>
              </div>

              {/* Creator */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Creador</label>
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-neutral-700 text-white flex items-center justify-center text-[10px]">
                    {detailTask?.creator?.name?.[0]?.toUpperCase() || detailTask?.creator?.email?.[0]?.toUpperCase() || "?"}
                  </div>
                  {detailTask?.creator?.name || detailTask?.creator?.email || "Desconocido"}
                </div>
              </div>

              {/* Created At */}
              {detailTask?.createdAt && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Creado</label>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(detailTask.createdAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={dndHandleDragStart} onDragOver={dndHandleDragOver} onDragEnd={dndHandleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:h-[calc(100vh-220px)]">
          {stagesToRender.map((column) => (
            <div key={column.id} id={column.id} className="flex-1 min-w-[280px] max-w-[350px] flex flex-col snap-start">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300">{column.name}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{getTasksByStage(column.id).length}</span>
              </div>
              <DroppableColumn id={column.id}>
              <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 space-y-2 overflow-y-auto border border-border">
                {getTasksByStage(column.id).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground dark:text-slate-500 text-sm">Sin tareas</div>
                ) : (
                  getTasksByStage(column.id).map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onOpenDetail={() => handleOpenDetail(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))
                )}
              </div>
              </DroppableColumn>
            </div>
          ))}
        </div>
        <DragOverlay>
          {draggedTask ? (
            <div className="w-[280px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-300 dark:border-slate-600 p-3 opacity-90">
              <p className="text-sm font-medium text-foreground">{draggedTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="rounded-lg border border-border overflow-hidden bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
            <thead className="bg-card">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Tarea</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Estado</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Prioridad</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Fecha límite</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Proyecto</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Asignado</th>
                <th className="text-right p-3 text-sm font-medium text-slate-600 dark:text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTasks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No hay tareas</td></tr>
              ) : (
                filteredTasks.map((task) => {
                  const taskStage = stagesToRender.find(s => isTaskInStage(task, s.id, stagesToRender)) || stagesToRender[0];
                  return (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => handleOpenDetail(task)}>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-foreground">{task.title}</p>
                          {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">{task.description}</p>}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="border text-[10px]" style={taskStage ? getStageBadgeStyle(taskStage.color) : undefined}>
                          {taskStage ? taskStage.name : task.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {task.priority !== "NONE" && (
                          <Badge variant="secondary" className={cn("border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-slate-600 dark:text-muted-foreground">{task.project?.name || getProjectName(task.projectId) || "-"}</td>
                      <td className="p-3 text-sm text-slate-600 dark:text-muted-foreground">{task.assignedTo || "-"}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(task); }} className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <Card className="bg-white dark:bg-slate-900 border-border">
              <CardContent className="py-12 text-center text-muted-foreground">No hay tareas</CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => {
              const taskStage = stagesToRender.find(s => isTaskInStage(task, s.id, stagesToRender)) || stagesToRender[0];
              return (
                <Card key={task.id} className="bg-white dark:bg-slate-900 border-border hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer" onClick={() => handleOpenDetail(task)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: taskStage?.color || "#64748b" }} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground truncate">{task.title}</h3>
                          <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] border" style={taskStage ? getStageBadgeStyle(taskStage.color) : undefined}>
                              {taskStage ? taskStage.name : task.status}
                            </Badge>
                            {task.priority !== "NONE" && (
                              <Badge variant="secondary" className={cn("text-[10px] border", priorityColors[task.priority])}>{priorityLabels[task.priority]}</Badge>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {(task.project?.name || getProjectName(task.projectId)) && (
                              <span className="hidden md:inline text-xs text-muted-foreground">{task.project?.name || getProjectName(task.projectId)}</span>
                            )}
                            {task.assignedTo && (
                              <span className="hidden md:inline text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{task.assignedTo}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="h-10 w-10 md:h-8 md:w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
      <TasksPageContent />
    </Suspense>
  );
}
