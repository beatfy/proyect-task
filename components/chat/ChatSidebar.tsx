"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X, Loader2, Sparkles, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import MarkdownRenderer from "./MarkdownRenderer";

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

      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner flex-shrink-0 animate-pulse">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">Ledy</h3>
              {projectName ? (
                <p className="text-[11px] text-muted-foreground truncate max-w-[160px] flex items-center gap-1">
                  <FolderKanban className="h-3 w-3 text-primary flex-shrink-0" />
                  <span>{projectName}</span>
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground truncate">
                  Selecciona un proyecto
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatMode((m) => m === "glm" ? "openclaw" : "glm")}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-full border transition-all font-semibold shadow-sm",
                chatMode === "openclaw"
                  ? "bg-primary border-primary text-white hover:bg-primary/90"
                  : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              title={chatMode === "glm" ? "Cambiar a OpenClaw" : "Cambiar a GLM"}
            >
              {chatMode === "glm" ? "GLM" : "🐙 OpenClaw"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 max-w-xs mx-auto py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md border border-primary/20 relative animate-bounce">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">
                  ¡Hola! Soy Ledy
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {projectName
                    ? `Estoy conectada al proyecto "${projectName}". ¿Qué puedo hacer por ti?`
                    : "Navega a un proyecto en Leadfy para comenzar."}
                </p>
              </div>
              {projectName && (
                <div className="flex flex-col gap-2 w-full mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-border hover:bg-primary/5 hover:border-primary/30 transition-all font-semibold text-muted-foreground hover:text-primary bg-card/50"
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
                className={cn(
                  "flex gap-2.5 items-start w-full animate-in fade-in slide-in-from-bottom-2 duration-200",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/20 shadow-inner">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] min-w-0 break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[var(--mediterranean-terracotta)] to-[#e27d5f] text-white rounded-tr-xs shadow-md"
                      : "bg-muted/45 dark:bg-card border border-border/40 text-foreground rounded-tl-xs"
                  )}
                >
                  {msg.content ? (
                    msg.role === "assistant" ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                    )
                  ) : isLastAssistantStreaming ? (
                    <div className="flex gap-1 items-center py-1">
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : null}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-border/20 flex flex-col gap-1.5">
                      {msg.actions.map((action, j) => (
                        <span
                          key={j}
                          className="text-[11px] bg-background/60 dark:bg-neutral-800/40 px-2 py-1 rounded-md border border-border/30 text-muted-foreground flex items-center gap-1 font-medium"
                        >
                          <span className="text-primary font-bold">•</span>
                          <span>{formatAction(action)}</span>
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
        <div className="p-3 border-t border-border bg-background">
          <div className="relative flex items-end gap-2 p-1 rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-300">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                projectId ? "Escribe un mensaje..." : "Navega a un proyecto primero"
              }
              rows={1}
              className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm focus:outline-none max-h-24 min-h-[36px] text-foreground placeholder-muted-foreground"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 96) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--mediterranean-terracotta)] to-[#e27d5f] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
