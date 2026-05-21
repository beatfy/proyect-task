"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Send, Bot, Loader2, Copy, Check, MessageSquare, FileText, Building2, X, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Metadatos de agentes ── */
const AGENTS: Record<string, { name: string; emoji: string; description: string }> = {
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

type Tab = "chat" | "templates";

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

  /* ── Cliente/Proyecto seleccionado ── */
  const [selectedClient, setSelectedClient] = useState<ProjectOption | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  /* Restaurar cliente desde localStorage */
  useEffect(() => {
    const stored = getStoredProject(agentId);
    if (stored) {
      setSelectedClient(stored);
      setShowClientSelector(false);
    }
  }, [agentId]);

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
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: prefixedMessage,
          projectId: selectedClient?.id || null,
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
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
      <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)]">
        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-neutral-900/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">{agent.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">{agent.description}</p>
          </div>
        </div>

        {/* Selector de cliente */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-neutral-900/10 flex items-center justify-center mx-auto mb-3">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">Selecciona un cliente</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Elige el proyecto/cliente para dar contexto a {agent.name}, o sáltalo si no es necesario.
              </p>
            </div>

            {/* Barra de búsqueda */}
            {projects.length > 5 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar proyecto..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            )}

            {/* Lista de proyectos */}
            {loadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando proyectos...</span>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => selectClient(project)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/50 transition-colors group",
                      selectedClient?.id === project.id && "border-neutral-900 bg-muted/50"
                    )}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-medium"
                      style={{ backgroundColor: project.color || "#6366f1" }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {project.organization && (
                          <span className="text-xs text-muted-foreground">
                            🏢 {project.organization.name}
                          </span>
                        )}
                        {project.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {project.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  </button>
                ))}
                {filteredProjects.length === 0 && !loadingProjects && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {projectSearch ? "No se encontraron proyectos" : "No hay proyectos disponibles"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botón saltar */}
            <div className="text-center pb-6">
              <Button
                variant="outline"
                onClick={skipClient}
                className="text-sm"
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
      <div className="flex items-center gap-3 border-b border-border pb-4 mb-4 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-neutral-900/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">{agent.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">{agent.name}</h1>
          <p className="text-xs text-muted-foreground">{agent.description}</p>
        </div>
      </div>

      {/* Badge de cliente seleccionado */}
      {selectedClient && (
        <div className="flex items-center gap-2 mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm">
            <span>📋</span>
            <span className="font-medium">Cliente: {selectedClient.name}</span>
            <button
              onClick={changeClient}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
            >
              Cambiar
            </button>
            <button
              onClick={clearClient}
              className="ml-1 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Quitar cliente"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
      {!selectedClient && !showClientSelector && (
        <div className="mb-3 px-1 flex-shrink-0">
          <button
            onClick={changeClient}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            Seleccionar cliente
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-4 flex-shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px]",
            activeTab === "chat"
              ? "border-neutral-900 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          💬 Chat
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px]",
            activeTab === "templates"
              ? "border-neutral-900 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="w-4 h-4" />
          📋 Templates
          {templates.length > 0 && (
            <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
              {templates.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenido de tabs */}
      {activeTab === "chat" ? (
        <>
          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-neutral-900/10 flex items-center justify-center">
                  <span className="text-3xl">{agent.emoji}</span>
                </div>
                <div>
                  <p className="font-medium">¡Hola! Soy {agent.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedClient
                      ? `Trabajando con: ${selectedClient.name}. ¿En qué puedo ayudarte?`
                      : `${agent.description}. ¿En qué puedo ayudarte?`
                    }
                  </p>
                </div>
                {selectedClient && (
                  <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm">
                    <span>📋</span>
                    <span>Cliente: {selectedClient.name}</span>
                  </div>
                )}
                {templates.length > 0 && (
                  <button
                    onClick={() => setActiveTab("templates")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                  >
                    Ver {templates.length} templates disponibles →
                  </button>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-neutral-900/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm">{agent.emoji}</span>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-neutral-900 text-white"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-neutral-900/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">{agent.emoji}</span>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="pt-4 border-t border-border mt-4 flex-shrink-0">
            <div className="flex items-end gap-2">
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
                className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 max-h-32"
                style={{ height: "auto", minHeight: "42px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="p-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
      ) : (
        <>
          {/* Tab de Templates */}
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Plantillas predefinidas para empezar rápido con {agent.name}. Haz clic en &quot;Usar&quot; para enviar directamente, o en el icono de copiar para llevar el texto al portapapeles.
              </p>
            </div>
            <div className="grid gap-3">
              {templates.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="group relative flex items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg">
                    {tmpl.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium">{tmpl.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(tmpl.prompt, idx)}
                      className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                      title="Copiar al portapapeles"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => useTemplate(tmpl.prompt)}
                      className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No hay templates disponibles para este agente aún.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
