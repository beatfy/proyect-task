"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Bot, Loader2, Copy, Check, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Metadatos de agentes ── */
const AGENTS: Record<string, { name: string; emoji: string; description: string }> = {
  "ads-commander": {
    name: "Ads Commander",
    emoji: "📢",
    description: "Especialista en Google Ads y Meta Ads",
  },
  "social-pulse-agent": {
    name: "Social Pulse",
    emoji: "📱",
    description: "Especialista en Social Media",
  },
  "seofilo-agent": {
    name: "SEOFilo",
    emoji: "🔍",
    description: "Especialista en SEO",
  },
  "design-agent": {
    name: "Design Agent",
    emoji: "🎨",
    description: "Especialista en Diseño y Branding",
  },
};

/* ── Templates por agente ── */
const AGENT_TEMPLATES: Record<string, { label: string; prompt: string; emoji: string }[]> = {
  "ads-commander": [
    { label: "Crear campaña Google Ads", prompt: "Crea una campaña de Google Ads para mi cliente", emoji: "📊" },
    { label: "Analizar campañas activas", prompt: "Analiza el rendimiento de mis campañas activas", emoji: "📈" },
    { label: "Optimizar presupuesto", prompt: "Revisa y optimiza el presupuesto de mis campañas de Ads", emoji: "💰" },
    { label: "Redacción de anuncios", prompt: "Escribe copy persuasivo para mis anuncios de Google Ads", emoji: "✍️" },
  ],
  "social-pulse-agent": [
    { label: "Calendario de contenido", prompt: "Genera un calendario de contenido para redes sociales", emoji: "📅" },
    { label: "Ideas para Instagram", prompt: "Dame ideas de post para Instagram", emoji: "💡" },
    { label: "Estrategia de contenido", prompt: "Crea una estrategia de contenido mensual para mis redes sociales", emoji: "📋" },
    { label: "Hashtags trending", prompt: "Sugiere hashtags trending para mi sector", emoji: "#️⃣" },
  ],
  "seofilo-agent": [
    { label: "Auditoría SEO", prompt: "Haz una auditoría SEO de mi web", emoji: "🔎" },
    { label: "Keywords sugeridas", prompt: "Sugiere keywords para posicionarme", emoji: "🔑" },
    { label: "Análisis de competencia", prompt: "Analiza el SEO de mis competidores directos", emoji: "🏆" },
    { label: "Plan de linkbuilding", prompt: "Crea un plan de linkbuilding para mejorar mi autoridad de dominio", emoji: "🔗" },
  ],
  "design-agent": [
    { label: "Diseñar logo", prompt: "Necesito un logo para mi cliente", emoji: "🎨" },
    { label: "Imagen para Instagram", prompt: "Genera una imagen para un post de Instagram", emoji: "🖼️" },
    { label: "Paleta de colores", prompt: "Crea una paleta de colores coherente para mi marca", emoji: "🎯" },
    { label: "Mockup presentación", prompt: "Genera un mockup de presentación para un cliente", emoji: "📐" },
  ],
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Tab = "chat" | "templates";

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

  /* Scroll al fondo al recibir mensajes */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus al input cuando cambiamos a chat tab */
  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  /* Reset copied state */
  useEffect(() => {
    if (copiedIdx !== null) {
      const t = setTimeout(() => setCopiedIdx(null), 2000);
      return () => clearTimeout(t);
    }
  }, [copiedIdx]);

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

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput("");
    setActiveTab("chat");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: messageText,
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
                    {agent.description}. ¿En qué puedo ayudarte?
                  </p>
                </div>
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
                placeholder={`Escribe un mensaje a ${agent.name}...`}
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
