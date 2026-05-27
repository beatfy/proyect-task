"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ tool: string; result: unknown }>;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_SUGGESTIONS = [
  "¿Qué tareas tengo pendientes?",
  "Resumen del proyecto",
  "Crear una tarea...",
  "¿Qué deadlines tengo esta semana?",
];

type ChatMode = "glm" | "openclaw";

export default function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("glm");
  const [projectName, setProjectName] = useState<string>();
  const [projectId, setProjectId] = useState<string>();
  const [organizationId, setOrganizationId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const match = pathname.match(/\/projects\/([^/]+)/);
    if (match) {
      const id = match[1];
      setProjectId(id);
      fetch(`/api/projects/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setProjectName(data.name || data.project?.name);
          if (data.organizationId || data.project?.organizationId) {
            setOrganizationId(data.organizationId || data.project?.organizationId);
          }
        })
        .catch(() => {});
    } else {
      setProjectId(undefined);
      setProjectName(undefined);
      setOrganizationId(undefined);
    }
  }, [pathname]);

  useEffect(() => {
    setMessages([]);
    if (projectId) {
      fetch(`/api/chat?projectId=${projectId}&limit=50`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load history");
          return r.json();
        })
        .then((data: Array<{ role: string; content: string; actions?: Array<{ tool: string; result: unknown }> }>) => {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(
              data.map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
                actions: m.actions,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput("");
    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (chatMode === "openclaw") {
        const res = await fetch("/api/chat/openclaw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            userId: organizationId || projectId || "anonymous",
            projectId,
            organizationId,
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
            {
              role: "assistant",
              content: data.response || "✅ Mensaje enviado a OpenClaw",
            },
          ]);
        }
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            projectId,
            organizationId,
            history,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Error desconocido" }));
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `⚠️ Error: ${errData.error || "Error del servidor"}` },
          ]);
          setIsLoading(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        const isStreaming = contentType.includes("text/event-stream");

        if (!isStreaming) {
          const data = await res.json();
          if (data.error) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `⚠️ Error: ${data.error}` },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: data.reply,
                actions: data.actions || [],
              },
            ]);
          }
          setIsLoading(false);
          return;
        }

        const placeholder: Message = { role: "assistant", content: "", actions: [] };
        setMessages((prev) => [...prev, placeholder]);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        const actions: Array<{ tool: string; result: unknown }> = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "token" && data.content) {
                fullContent += data.content as string;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              } else if (data.type === "action") {
                actions.push({ tool: data.tool as string, result: data.result });
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    actions: [...actions],
                  };
                  return updated;
                });
              } else if (data.type === "done") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                    actions,
                  };
                  return updated;
                });
              } else if (data.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: `⚠️ Error: ${data.error}`,
                    actions: [],
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error de conexión. Intenta de nuevo.",
        },
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

  const formatAction = (action: { tool: string; result: unknown }) => {
    const result = action.result as Record<string, unknown>;
    switch (action.tool) {
      case "task_create":
        return `✅ Tarea creada: ${(result.task as Record<string, string>)?.title || "Sin título"}`;
      case "task_update":
        return `✏️ Tarea actualizada: ${(result.task as Record<string, string>)?.title || ""}`;
      case "task_delete":
        return "🗑️ Tarea eliminada";
      case "task_move":
        return `📋 Tarea movida a ${(result.task as Record<string, string>)?.status || ""}`;
      case "project_summary":
        return "📊 Resumen generado";
      case "member_assign":
        return `👤 Miembro asignado`;
      case "time_log":
        return `⏱️ ${(result.entry as Record<string, number>)?.hours || 0}h registradas`;
      case "project_create":
        return `📁 Proyecto creado: ${(result.project as Record<string, string>)?.name || ""}`;
      case "contact_create":
        return `👤 Contacto creado: ${(result.contact as Record<string, string>)?.name || ""}`;
      case "deal_create":
        return `💰 Deal creado: ${(result.deal as Record<string, string>)?.title || ""}`;
      case "deal_move":
        return `🔄 Deal movido a: ${(result.deal as Record<string, string>)?.stage || ""}`;
      default:
        return `⚡ ${action.tool}`;
    }
  };

  if (!isOpen) return null;

  const lastMsg = messages[messages.length - 1];
  const isStreaming = lastMsg?.role === "assistant" && lastMsg.content === "" && isLoading;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l border-border z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-neutral-900/10 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ledy</h3>
              {projectName ? (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  📁 {projectName}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecciona un proyecto
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setChatMode((m) => m === "glm" ? "openclaw" : "glm")}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              chatMode === "openclaw"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-border hover:bg-muted"
            }`}
            title={chatMode === "glm" ? "Cambiar a OpenClaw" : "Cambiar a GLM"}
          >
            {chatMode === "glm" ? "GLM" : "🐙"}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-900/10 flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <p className="font-medium text-sm">
                  ¡Hola! Soy Ledy
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {projectName
                    ? `Trabajando en ${projectName}`
                    : "Navega a un proyecto para empezar"}
                </p>
              </div>
              {projectName && (
                <div className="flex flex-col gap-1.5 w-full">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistantStreaming = msg.role === "assistant" && i === messages.length - 1 && msg.content === "" && isLoading;
            return (
              <div
                key={i}
                className={`flex gap-2 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-neutral-900/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs">🤖</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-neutral-900 text-white"
                      : "bg-muted"
                  }`}
                >
                  {msg.content ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : isLastAssistantStreaming ? (
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : null}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {msg.actions.map((action, j) => (
                        <span
                          key={j}
                          className="text-xs bg-background/50 px-2 py-1 rounded-md"
                        >
                          {formatAction(action)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                projectId ? "Escribe un mensaje..." : "Navega a un proyecto primero"
              }
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 max-h-32"
              style={{ height: "auto", minHeight: "38px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
