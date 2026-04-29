import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history, projectId } = await req.json();

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json({ error: "agentId es requerido" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
    const authToken = process.env.OPENCLAW_AUTH_TOKEN || "";

    if (!authToken) {
      return NextResponse.json({ error: "OPENCLAW_AUTH_TOKEN no configurado" }, { status: 500 });
    }

    // Buscar contexto del proyecto/cliente si se proporciona projectId
    let clientContext = "";
    if (projectId && typeof projectId === "string") {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, description: true, clientContext: true },
        });

        if (project) {
          // Fetch task counts by status
          const taskCountByStatus = await prisma.task.groupBy({
            by: ["status"],
            where: { projectId },
            _count: { id: true },
          });

          const statusCounts = Object.fromEntries(
            taskCountByStatus.map((t) => [t.status, t._count.id])
          );
          const todoCount = statusCounts["TODO"] ?? 0;
          const inProgressCount = statusCounts["IN_PROGRESS"] ?? 0;
          const doneCount = statusCounts["DONE"] ?? 0;

          // Last 5 completed tasks
          const recentDoneTasks = await prisma.task.findMany({
            where: { projectId, status: "DONE" },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { title: true },
          });

          // Recent chat messages for this project
          const recentChatMessages = await prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { role: true, content: true },
          });

          // Recent comments on tasks in this project
          const recentComments = await prisma.comment.findMany({
            where: { task: { projectId } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { content: true },
          });

          let sysContext = `\n\n---\n[SISTEMA] Cliente: "${project.name}"
- Descripcion: ${project.description || "Sin descripcion"}
- Tareas: ${todoCount} pendientes, ${inProgressCount} en progreso, ${doneCount} completadas
- Ultimas tareas completadas: ${recentDoneTasks.map((t) => t.title).join(", ") || "Ninguna"}
- Notas recientes: ${recentComments.map((c) => c.content).slice(0, 3).join(" | ") || "Ninguna"}
- Historial de chat: ${recentChatMessages.slice(0, 3).map((m) => `${m.role}: ${m.content.substring(0, 100)}`).join(" | ") || "Ninguno"}`;

          if (project.clientContext) {
            sysContext += `\n\n---\n[CONTEXTO DEL CLIENTE — USO ESTRICTO]\n${project.clientContext}\n[FIN CONTEXTO]`;
          }

          clientContext = sysContext;
        }
      } catch (dbErr) {
        console.error("DB lookup error:", dbErr);
      }
    }

    // Construir mensajes
    const messages: Array<{ role: string; content: string }> = [];

    // Anadir historial (ultimos 20 mensajes)
    if (Array.isArray(history) && history.length > 0) {
      const contextMsg = history.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      messages.push(...contextMsg);
    }

    // Anadir mensaje actual con contexto del cliente
    const finalMessage = clientContext
      ? `${message}${clientContext}`
      : message;

    messages.push({ role: "user", content: finalMessage });

    const model = `openclaw/${agentId}`;

    async function gatewayCallWithRetry(url: string, body: unknown, retries = 3, delayMs = 2000): Promise<Response> {
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(300000)
          });
          if (res.ok) return res;
          if (res.status >= 500 && attempt < retries) {
            console.warn(`Gateway returned ${res.status}, retrying (${attempt}/${retries})...`);
            await new Promise(r => setTimeout(r, delayMs * attempt));
            continue;
          }
          return res;
        } catch (err) {
          lastErr = err as Error;
          if (attempt < retries) {
            console.warn(`Gateway fetch error, retrying (${attempt}/${retries})...`, err);
            await new Promise(r => setTimeout(r, delayMs * attempt));
          }
        }
      }
      throw lastErr || new Error("Gateway call failed after retries");
    }

    let gatewayRes: Response;
    try {
      gatewayRes = await gatewayCallWithRetry(
        `${gatewayUrl}/v1/chat/completions`,
        { model, messages, temperature: 0.7, max_tokens: 16000 }
      );
    } catch (err) {
      console.error("Agent chat error after retries:", err);
      return NextResponse.json({ error: "El agente no esta disponible. Intenta de nuevo en unos segundos." }, { status: 503 });
    }

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text().catch(() => "Error gateway");
      console.error(`Gateway error [${gatewayRes.status}]:`, errText);
      const errorMsg = gatewayRes.status === 429
        ? "El agente esta ocupado. Intenta de nuevo en unos segundos."
        : gatewayRes.status === 503
        ? "El agente no esta disponible temporalmente."
        : "Error al conectar con el agente.";
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const gatewayData = await gatewayRes.json();
    const response = gatewayData.choices?.[0]?.message?.content || "Sin respuesta del agente";

    return NextResponse.json({ response });

  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
