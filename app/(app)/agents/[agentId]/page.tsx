"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Send, Bot, Loader2, Copy, Check, MessageSquare, FileText, Building2, X, ChevronRight, Search, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";

/* ── Metadatos de agentes ── */
const AGENTS: Record<string, { name: string; emoji: string; description: string }> = {
  "ele": {
    name: "Ele",
    emoji: "⚡",
    description: "Asistente personal estratégico: planificación, análisis y automatización",
  },
  "seo-agent": {
    name: "SEO Specialist",
    emoji: "🔍",
    description: "Auditorías técnicas, keyword research, optimización on-page y estrategia de contenidos",
  },
  "sem-agent": {
    name: "SEM Specialist",
    emoji: "📈",
    description: "Campañas Google Ads, PPC, optimización de ROAS y análisis de performance",
  },
  "social-agent": {
    name: "Social Media Specialist",
    emoji: "📱",
    description: "Calendarios editoriales, copywriting, community management y estrategia social",
  },
};

/* ── Templates por agente ── */
const AGENT_TEMPLATES: Record<string, { label: string; prompt: string; emoji: string }[]> = {
  "ele": [
    { label: "Planificación estratégica", prompt: "Analiza los proyectos y tareas activos del cliente y genera un plan de acción prioritario para la próxima semana. Incluye deadlines, dependencias y recursos necesarios.", emoji: "🎯" },
    { label: "Automatización de tareas", prompt: "Identifica procesos repetitivos en el flujo de trabajo del cliente y propón automatizaciones usando herramientas disponibles (APIs, scripts, integraciones).", emoji: "⚙️" },
    { label: "Análisis de rendimiento", prompt: "Revisa los datos del cliente (tareas completadas, tiempos, pipeline) y genera un informe de rendimiento con KPIs y áreas de mejora.", emoji: "📊" },
    { label: "Resumen ejecutivo", prompt: "Genera un resumen ejecutivo del estado actual de todos los proyectos del cliente: avance, bloqueos, próximos hitos y decisiones pendientes.", emoji: "📋" },
  ],
  "seo-agent": [
    { label: "Auditoría SEO", prompt: "Realiza una auditoría SEO técnica completa del sitio web del cliente. Analiza velocidad, indexación, mobile-friendly, estructura de URLs, meta tags, headings y backlinks. Proporcione un informe detallado con prioridades de acción.", emoji: "🔍" },
    { label: "Keyword Research", prompt: "Realiza un keyword research estratégico para el cliente. Identifica keywords de alto volumen y baja competencia, keywords long-tail, intención de búsqueda y oportunidades de contenido.", emoji: "🎯" },
    { label: "Optimización On-Page", prompt: "Optimiza la página [URL] del cliente. Mejora títulos SEO, meta descriptions, headings, estructura de contenido, internal linking y schema markup.", emoji: "⚡" },
    { label: "Estrategia de Contenidos", prompt: "Crea una estrategia de content marketing para el cliente. Propón temas, calendario editorial, formatos de contenido y distribución por canales.", emoji: "📝" },
  ],
  "sem-agent": [
    { label: "Campaña Google Ads", prompt: "Diseña una campaña de Google Ads para el cliente. Define estructura de campañas, grupos de anuncios, keywords, presupuesto y estrategia de pujas.", emoji: "🎯" },
    { label: "Optimizar ROAS", prompt: "Analiza las campañas activas del cliente y propón optimizaciones para mejorar el ROAS. Revisa audiencias, creatividades, landing pages y presupuestos.", emoji: "📊" },
    { label: "A/B Testing", prompt: "Diseña un plan de A/B testing para los anuncios del cliente. Propón variantes de copy, visuals, CTAs y estrategia de medición.", emoji: "🧪" },
    { label: "Remarketing", prompt: "Crea una estrategia de remarketing para el cliente. Define segmentos de audiencia, mensajes por etapa del funnel y presupuesto recomendado.", emoji: "🔄" },
  ],
  "social-agent": [
    { label: "Calendario Editorial", prompt: "Crea un calendario editorial mensual para el cliente. Incluye posts por red social, formatos, copy sugerido y hashtags.", emoji: "📅" },
    { label: "Copywriting", prompt: "Escribe copy para 5 posts de [red social] del cliente. Adapta el tono a la marca y propón CTAs efectivos.", emoji: "✍️" },
    { label: "Estrategia Viral", prompt: "Diseña una estrategia de contenido viral para el cliente. Identifica formatos trending, hooks efectivos y oportunidades de participación.", emoji: "🚀" },
    { label: "Community Management", prompt: "Crea un plan de community management para el cliente. Define horarios de respuesta, tono de voz, protocolos de crisis y métricas de engagement.", emoji: "💬" },
  ],
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProjectOption {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  organization?: { name: string } | null;
}

type Tab = "chat" | "templates" | "documents";

interface AgentDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  createdAt: string;
  agentId?: string | null;
}

/* ── localStorage helpers ── */
function getStoredProject(agentId: string): ProjectOption | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`agent-client-${agentId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredProject(agentId: string, project: ProjectOption | null) {
  if (typeof window === "undefined") return;
  if (project) {
    localStorage.setItem(`agent-client-${agentId}`, JSON.stringify(project));
  } else {
    localStorage.removeItem(`agent-client-${agentId}`);
  }
}

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const agent = AGENTS[agentId];
  const templates = AGENT_TEMPLATES[agentId] || [];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [allDocuments, setAllDocuments] = useState<AgentDocument[]>([]);
  const [activeDocIds, setActiveDocIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/documents?agentId=${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAllDocuments(data);
      }
    } catch (err) {
      console.error("Error fetching agent documents:", err);
    }
  }, [agentId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, autoAttach = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const loadingToast = toast.loading("Subiendo y procesando documento...");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("agentId", agentId);

        const res = await fetch("/api/agents/documents", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const newDoc = await res.json();
          setAllDocuments((prev) => [
            {
              id: newDoc.id,
              name: newDoc.name,
              url: newDoc.url,
              type: newDoc.type,
              size: newDoc.size,
              createdAt: newDoc.createdAt,
              agentId,
            },
            ...prev,
          ]);

          if (autoAttach) {
            setActiveDocIds((prev) => [...prev, newDoc.id]);
            toast.success(`"${newDoc.name}" subido e incluido en el chat.`);
          } else {
            toast.success(`"${newDoc.name}" subido con éxito.`);
          }
        } else {
          const err = await res.json();
          toast.error(err.error || "Error al subir el archivo");
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Error de conexión al subir el archivo");
    } finally {
      setUploading(false);
      toast.dismiss(loadingToast);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente "${name}"?`)) return;

    try {
      const res = await fetch(`/api/agents/documents/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAllDocuments((prev) => prev.filter((d) => d.id !== id));
        setActiveDocIds((prev) => prev.filter((docId) => docId !== id));
        toast.success(`"${name}" eliminado.`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al eliminar el documento");
      }
    } catch (err) {
      console.error("Delete document error:", err);
      toast.error("Error de conexión al eliminar");
    }
  };

  const toggleDocumentAttach = (id: string) => {
    setActiveDocIds((prev) =>
      prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]
    );
  };

  /* ── Cliente/Proyecto seleccionado ── */
  const isPersonalAgent = agentId === "ele";
  const [selectedClient, setSelectedClient] = useState<ProjectOption | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(!isPersonalAgent);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  /* Restaurar cliente desde localStorage (solo para agentes no personales) */
  useEffect(() => {
    if (isPersonalAgent) {
      setShowClientSelector(false);
      return;
    }
    const stored = getStoredProject(agentId);
    if (stored) {
      setSelectedClient(stored);
      setShowClientSelector(false);
    }
  }, [agentId, isPersonalAgent]);

  /* Iniciar siempre con pantalla limpia al cambiar de agente o cliente */
  useEffect(() => {
    setMessages([]);
  }, [agentId, selectedClient?.id]);

  /* Cargar proyectos */
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const mapped: ProjectOption[] = (data as Array<{
          id: string;
          name: string;
          description?: string | null;
          color: string;
          organization?: { name: string } | null;
        }>).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          color: p.color,
          organization: p.organization,
        }));
        setProjects(mapped);
      }
    } catch {
      /* silencioso */
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (showClientSelector) {
      fetchProjects();
    }
  }, [showClientSelector, fetchProjects]);

  /* Scroll al fondo al recibir mensajes */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus al input cuando cambiamos a chat tab */
  useEffect(() => {
    if (activeTab === "chat" && !showClientSelector) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab, showClientSelector]);

  /* Reset copied state */
  useEffect(() => {
    if (copiedIdx !== null) {
      const t = setTimeout(() => setCopiedIdx(null), 2000);
      return () => clearTimeout(t);
    }
  }, [copiedIdx]);

  /* ── Seleccionar cliente ── */
  const selectClient = (project: ProjectOption) => {
    setSelectedClient(project);
    setStoredProject(agentId, project);
    setShowClientSelector(false);
  };

  const skipClient = () => {
    setSelectedClient(null);
    setStoredProject(agentId, null);
    setShowClientSelector(false);
  };

  const changeClient = () => {
    setShowClientSelector(true);
    fetchProjects();
  };

  const clearClient = () => {
    setSelectedClient(null);
    setStoredProject(agentId, null);
  };

  /* Agente no encontrado */
  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Agente no encontrado</h2>
        <p className="text-muted-foreground text-sm">El agente &quot;{agentId}&quot; no existe.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  /* ── Filtrar proyectos por búsqueda ── */
  const filteredProjects = projectSearch.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.organization?.name || "").toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects;

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput("");
    setActiveTab("chat");

    // Prefijar con contexto de cliente si hay seleccionado
    const prefixedMessage = selectedClient
      ? `[Cliente: ${selectedClient.name}] ${messageText}`
      : messageText;

    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        agentId,
        message: prefixedMessage,
        history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        documentIds: activeDocIds,
      };
      if (!isPersonalAgent && selectedClient) {
        body.projectId = selectedClient.id;
      }
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response || "Sin respuesta" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error de conexión. Intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
    } catch {
      /* fallback */
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedIdx(idx);
    }
  };

  const useTemplate = (prompt: string) => {
    sendMessage(prompt);
  };

  /* ════════════════════════════════════════════
     RENDER: Selector de cliente
     ════════════════════════════════════════════ */
  if (showClientSelector) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] animate-in fade-in duration-300">
        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4 flex-shrink-0 bg-background/80 backdrop-blur sticky top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
            <span className="text-xl">{agent.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{agent.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
          </div>
        </div>

        {/* Selector de cliente */}
        <div className="flex-1 overflow-y-auto px-1">
          <div className="max-w-3xl mx-auto py-4">
            <div className="text-center mb-8 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-sm">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Selecciona un cliente</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Elige el proyecto/cliente para dar contexto a las respuestas de {agent.name}, o sáltalo si no es necesario.
              </p>
            </div>

            {/* Barra de búsqueda */}
            {projects.length > 5 && (
              <div className="relative mb-6 max-w-md mx-auto animate-in fade-in duration-300">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar proyecto..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                />
              </div>
            )}

            {/* Lista de proyectos */}
            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mt-3 text-sm text-muted-foreground">Cargando proyectos...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => selectClient(project)}
                    className={cn(
                      "relative overflow-hidden flex flex-col justify-between items-start rounded-2xl border border-border p-5 text-left bg-card hover:bg-muted/30 hover:border-primary/50 transition-all duration-300 hover:shadow-md group w-full",
                      selectedClient?.id === project.id && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <div className="flex items-start justify-between w-full gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-inner transition-transform group-hover:scale-105"
                        style={{ backgroundColor: project.color || "#6366f1" }}
                      >
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-muted px-2.5 py-0.5 rounded-full">
                        Proyecto
                      </span>
                    </div>
                    <div className="w-full min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {project.organization && (
                          <span className="text-xs text-muted-foreground/80 font-medium truncate flex items-center gap-1">
                            🏢 {project.organization.name}
                          </span>
                        )}
                        {project.description && (
                          <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1 italic">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0 transition-transform">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                  </button>
                ))}
                {filteredProjects.length === 0 && !loadingProjects && (
                  <div className="text-center py-12 col-span-full border border-dashed border-border rounded-2xl bg-card">
                    <p className="text-sm text-muted-foreground">
                      {projectSearch ? "No se encontraron proyectos" : "No hay proyectos disponibles"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botón saltar */}
            <div className="text-center pb-8 animate-in fade-in duration-300">
              <Button
                variant="outline"
                onClick={skipClient}
                className="text-sm rounded-xl px-5 hover:bg-muted transition-all"
              >
                Continuar sin cliente →
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     RENDER: Chat con tabs
     ════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)]">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-border pb-4 mb-4 flex-shrink-0 bg-background/80 backdrop-blur sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
          <span className="text-xl">{agent.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">{agent.name}</h1>
          <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
        </div>
      </div>

      {/* Badge de cliente seleccionado (solo para agentes no personales) */}
      {!isPersonalAgent && selectedClient && (
        <div className="flex items-center gap-2 mb-4 px-1 flex-shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="flex items-center gap-2 rounded-full bg-primary/5 border border-primary/20 px-3.5 py-1.5 text-xs">
            <span className="text-primary font-bold">●</span>
            <span className="font-semibold text-foreground/90">Cliente Activo: {selectedClient.name}</span>
            <button
              onClick={changeClient}
              className="text-[11px] text-primary hover:text-primary/80 font-semibold underline underline-offset-2 ml-2 transition-colors"
            >
              Cambiar
            </button>
            <button
              onClick={clearClient}
              className="ml-2 p-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
              title="Quitar cliente"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      {!isPersonalAgent && !selectedClient && !showClientSelector && (
        <div className="mb-4 px-1 flex-shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
          <button
            onClick={changeClient}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-primary/45 bg-card hover:bg-primary/5 transition-all duration-200"
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Vincular a cliente/proyecto</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/60 dark:bg-neutral-800/40 mb-5 flex-shrink-0 w-max max-w-full shadow-inner animate-in fade-in duration-300">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200",
            activeTab === "chat"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/20"
          )}
        >
          <MessageSquare className="w-4 h-4 text-primary" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200",
            activeTab === "templates"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/20"
          )}
        >
          <FileText className="w-4 h-4 text-primary" />
          <span>Plantillas</span>
          {templates.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/10 text-primary font-bold rounded-full px-1.5 py-0.5">
              {templates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200",
            activeTab === "documents"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/20"
          )}
        >
          <Paperclip className="w-4 h-4 text-primary" />
          <span>Documentos</span>
          {allDocuments.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/10 text-primary font-bold rounded-full px-1.5 py-0.5">
              {allDocuments.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenido de tabs */}
      {activeTab === "chat" ? (
        <>
          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-6 max-w-lg mx-auto py-12 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center shadow-md border border-primary/20 relative group hover:scale-105 transition-all duration-300">
                  <span className="text-4xl group-hover:rotate-12 transition-transform duration-300">{agent.emoji}</span>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Conversa con {agent.name}</h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                    {selectedClient
                      ? `Listo para colaborar en el proyecto "${selectedClient.name}". ¿Qué analizamos hoy?`
                      : `${agent.description}.`
                    }
                  </p>
                </div>
                
                {selectedClient && (
                  <div className="flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-4 py-1.5 text-xs text-primary font-medium">
                    <span>📋</span>
                    <span>Vinculado a {selectedClient.name}</span>
                  </div>
                )}

                {templates.length > 0 && (
                  <button
                    onClick={() => setActiveTab("templates")}
                    className="text-xs text-primary/80 font-bold hover:text-primary transition-colors border border-primary/20 rounded-full px-4 py-2 hover:bg-primary/5 transition-all shadow-sm"
                  >
                    Ver {templates.length} plantillas sugeridas →
                  </button>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 items-start w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0 shadow-sm mt-1 transition-transform hover:scale-105">
                    <span className="text-sm">{agent.emoji}</span>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4.5 py-3.5 shadow-sm text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[var(--mediterranean-terracotta)] to-[#e27d5f] text-white rounded-tr-sm shadow-md"
                      : "bg-muted/45 dark:bg-card border border-border/40 text-foreground rounded-tl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 items-start w-full animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0 shadow-sm mt-1 animate-pulse">
                  <span className="text-sm">{agent.emoji}</span>
                </div>
                <div className="bg-muted/40 dark:bg-card border border-border/40 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center justify-center">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="pt-4 border-t border-border mt-4 flex-shrink-0 bg-background">
            {/* Archivos adjuntos activos en chat */}
            {activeDocIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {allDocuments
                  .filter((d) => activeDocIds.includes(d.id))
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/20 pl-3 pr-2 py-1 text-xs text-foreground group shadow-sm hover:bg-primary/10 transition-all"
                    >
                      <span className="truncate max-w-[150px] font-medium">📄 {doc.name}</span>
                      <button
                        onClick={() => toggleDocumentAttach(doc.id)}
                        className="text-muted-foreground hover:text-red-500 rounded-full p-0.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Desasociar del chat"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 p-1.5 rounded-2xl border border-border bg-card shadow-sm hover:shadow focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all duration-300">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={(e) => handleFileUpload(e, true)}
                className="hidden"
                accept=".txt,.csv,.md,.json,.pdf,.xlsx,.xls"
                multiple
              />
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={uploading || isLoading}
                className="p-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Adjuntar documentos (.pdf, .xlsx, .txt, .csv, .md, .json)"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedClient
                  ? `Mensaje sobre ${selectedClient.name}...`
                  : `Escribe un mensaje a ${agent.name}...`
                }
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm focus:outline-none max-h-32 min-h-[40px] text-foreground placeholder-muted-foreground"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && activeDocIds.length === 0) || isLoading}
                className="p-3 rounded-xl bg-gradient-to-br from-[var(--mediterranean-terracotta)] to-[#e27d5f] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </>
      ) : activeTab === "templates" ? (
        <>
          {/* Tab de Templates */}
          <div className="flex-1 overflow-y-auto">
            <div className="mb-6 animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Plantillas predefinidas para empezar rápido con {agent.name}. Haz clic en &quot;Usar plantilla&quot; para enviar directamente, o en el botón de copiar.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {templates.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border p-5 bg-card hover:bg-muted/30 transition-all duration-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 text-lg group-hover:scale-105 transition-transform">
                      {tmpl.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{tmpl.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">{tmpl.prompt}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/40">
                    <button
                      onClick={() => copyToClipboard(tmpl.prompt, idx)}
                      className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
                      title="Copiar al portapapeles"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => useTemplate(tmpl.prompt)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-br from-[var(--mediterranean-terracotta)] to-[#e27d5f] text-white text-xs font-semibold hover:opacity-90 shadow-sm transition-all"
                    >
                      Usar plantilla
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl col-span-full bg-card">
                  <FileText className="w-10 h-10 text-muted-foreground mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-foreground">No hay plantillas disponibles</p>
                  <p className="text-xs text-muted-foreground mt-1">Este agente no tiene plantillas configuradas aún.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Biblioteca de Documentos del Agente</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sube archivos para analizarlos con {agent.name}. Activa o desactiva su inclusión en el chat.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e, false)}
                className="hidden"
                accept=".txt,.csv,.md,.json,.pdf,.xlsx,.xls"
                multiple
              />
              <Button
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs flex items-center gap-1.5 rounded-xl px-4 py-2 shadow-sm animate-in fade-in duration-300"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" />
                )}
                Subir Documentos
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-4 animate-in fade-in duration-300">
            {allDocuments.map((doc) => {
              const isActive = activeDocIds.includes(doc.id);
              const formattedSize = doc.size
                ? `${(doc.size / 1024).toFixed(1)} KB`
                : "Tamaño desconocido";
              const formattedDate = new Date(doc.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={doc.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 rounded-2xl border border-border bg-card hover:shadow-sm transition-all duration-200",
                    isActive && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-lg flex-shrink-0 font-medium border border-border/40 shadow-inner">
                      {doc.type === "pdf" ? "📕" : doc.type === "excel" ? "📗" : "📄"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate pr-2" title={doc.name}>
                        {doc.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formattedSize}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                    <button
                      onClick={() => toggleDocumentAttach(doc.id)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm",
                        isActive
                          ? "bg-primary border-primary text-white hover:bg-primary/90"
                          : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isActive ? "✓ Activo" : "Incluir en Chat"}
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                      className="p-2 rounded-xl border border-border hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {allDocuments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-card">
                <FileText className="w-10 h-10 text-muted-foreground mb-3 animate-pulse" />
                <p className="text-sm font-bold text-foreground">No hay documentos en la biblioteca</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 px-4 leading-relaxed">
                  Sube tus archivos en formato PDF, Excel o Texto para que el agente pueda analizarlos y ayudarte con tus análisis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
