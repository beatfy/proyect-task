"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Bot, Loader2 } from "lucide-react";
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const agent = AGENTS[agentId];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Scroll al fondo al recibir mensajes */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus al input */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        <div>
          <h1 className="text-lg font-semibold">{agent.name}</h1>
          <p className="text-xs text-muted-foreground">{agent.description}</p>
        </div>
      </div>

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
            {/* Sugerencias rápidas */}
            <div className="flex flex-col gap-1.5 w-full max-w-md">
              {agentId === "ads-commander" && (
                <>
                  <button onClick={() => sendMessage("Crea una campaña de Google Ads para mi cliente")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    📊 Crea una campaña de Google Ads para mi cliente
                  </button>
                  <button onClick={() => sendMessage("Analiza el rendimiento de mis campañas activas")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    📈 Analiza el rendimiento de mis campañas activas
                  </button>
                </>
              )}
              {agentId === "social-pulse-agent" && (
                <>
                  <button onClick={() => sendMessage("Genera un calendario de contenido para redes sociales")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    📅 Genera un calendario de contenido para redes sociales
                  </button>
                  <button onClick={() => sendMessage("Dame ideas de post para Instagram")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    💡 Dame ideas de post para Instagram
                  </button>
                </>
              )}
              {agentId === "seofilo-agent" && (
                <>
                  <button onClick={() => sendMessage("Haz una auditoría SEO de mi web")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    🔎 Haz una auditoría SEO de mi web
                  </button>
                  <button onClick={() => sendMessage("Sugiere keywords para posicionarme")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    🔑 Sugiere keywords para posicionarme
                  </button>
                </>
              )}
              {agentId === "design-agent" && (
                <>
                  <button onClick={() => sendMessage("Necesito un logo para mi cliente")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    🎨 Necesito un logo para mi cliente
                  </button>
                  <button onClick={() => sendMessage("Genera una imagen para un post de Instagram")} className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    🖼️ Genera una imagen para un post de Instagram
                  </button>
                </>
              )}
            </div>
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
    </div>
  );
}
