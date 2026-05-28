import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { agentRateLimit } from "@/lib/ai-rate-limit";
import { cuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

const INNIX_HOST = process.env.INNIX_HOST || "http://83.143.109.249";

const AGENT_CONFIG: Record<string, { port: number; apiKey: string; model: string }> = {
  "seo-agent": {
    port: 8642,
    apiKey: process.env.INNIX_SEO_KEY || "sk-seo-3088502f40cffb7ec560eefb2db5d0c2",
    model: "kimi-k2.6",
  },
  "sem-agent": {
    port: 8643,
    apiKey: process.env.INNIX_SEM_KEY || "sk-sem-7d4f8a9e2b1c5d6e3f0a8b7c4d2e1f5a6b3c8d9e0f1a2b3c4d5e6f7a8b9c0d1e",
    model: "kimi-k2.6",
  },
  "social-agent": {
    port: 8644,
    apiKey: process.env.INNIX_SOCIAL_KEY || "sk-social-f8e7d6c5b4a3928170654433221100ffeeddccbbaa99887766554433221100",
    model: "kimi-k2.6",
  },
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const projectId = searchParams.get("projectId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!agentId) {
      return NextResponse.json({ error: "agentId es requerido" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: authResult.userId, agentId };
    if (projectId) where.projectId = projectId;

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error("Agent chat GET error:", error);
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rateCheck = await agentRateLimit(authResult.userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite de llamadas al agente. Espera un momento.", remaining: rateCheck.remaining },
        { status: 429 }
      );
    }

    const { agentId, message, history, projectId } = await req.json();

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json({ error: "agentId es requerido" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const agentConfig = AGENT_CONFIG[agentId];
    if (!agentConfig) {
      return NextResponse.json({ error: "Agente no reconocido" }, { status: 400 });
    }

    const agentUrl = `${INNIX_HOST}:${agentConfig.port}/v1/chat/completions`;

    let organizationId: string | null = null;

    let clientContext = "";
    if (projectId && typeof projectId === "string") {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, description: true, clientContext: true, organizationId: true },
        });

        if (project) {
          organizationId = project.organizationId;

          const taskCountByStatus = await prisma.task.groupBy({
            by: ["status"],
            where: { projectId },
            _count: { id: true },
          });

          const statusCounts = Object.fromEntries(
            taskCountByStatus.map((t: { status: string; _count: { id: number } }) => [t.status, t._count.id])
          );
          const todoCount = statusCounts["TODO"] ?? 0;
          const inProgressCount = statusCounts["IN_PROGRESS"] ?? 0;
          const doneCount = statusCounts["DONE"] ?? 0;

          const recentDoneTasks = await prisma.task.findMany({
            where: { projectId, status: "DONE" },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { title: true },
          });

          const recentChatMessages = await prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { role: true, content: true },
          });

          const recentComments = await prisma.comment.findMany({
            where: { task: { projectId } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { content: true },
          });

          let sysContext = `\n\n---\n[SISTEMA] Cliente: "${project.name}"
- Descripcion: ${project.description || "Sin descripcion"}
- Tareas: ${todoCount} pendientes, ${inProgressCount} en progreso, ${doneCount} completadas
- Ultimas tareas completadas: ${recentDoneTasks.map((t: { title: string }) => t.title).join(", ") || "Ninguna"}
- Notas recientes: ${recentComments.map((c: { content: string }) => c.content).slice(0, 3).join(" | ") || "Ninguna"}
- Historial de chat: ${recentChatMessages.slice(0, 3).map((m: { role: string; content: string }) => `${m.role}: ${m.content.substring(0, 100)}`).join(" | ") || "Ninguno"}`;

          if (project.clientContext) {
            sysContext += `\n\n---\n[CONTEXTO DEL CLIENTE — USO ESTRICTO]\n${project.clientContext}\n[FIN CONTEXTO]`;
          }

          clientContext = sysContext;
        }
      } catch (dbErr) {
        console.error("DB lookup error:", dbErr);
      }
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        projectId: projectId || null,
        role: "user",
        content: message,
        organizationId: organizationId || null,
        agentId,
      },
    });

    const messages: Array<{ role: string; content: string }> = [];

    if (Array.isArray(history) && history.length > 0) {
      const contextMsg = history.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      messages.push(...contextMsg);
    }

    const finalMessage = clientContext
      ? `${message}${clientContext}`
      : message;

    messages.push({ role: "user", content: finalMessage });

    async function callAgentWithRetry(url: string, body: unknown, key: string, retries = 3, delayMs = 2000): Promise<Response> {
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(300000)
          });
          if (res.ok) return res;
          if (res.status >= 500 && attempt < retries) {
            console.warn(`Agent returned ${res.status}, retrying (${attempt}/${retries})...`);
            await new Promise(r => setTimeout(r, delayMs * attempt));
            continue;
          }
          return res;
        } catch (err) {
          lastErr = err as Error;
          if (attempt < retries) {
            console.warn(`Agent fetch error, retrying (${attempt}/${retries})...`, err);
            await new Promise(r => setTimeout(r, delayMs * attempt));
          }
        }
      }
      throw lastErr || new Error("Agent call failed after retries");
    }

    let agentRes: Response;
    try {
      agentRes = await callAgentWithRetry(
        agentUrl,
        { model: agentConfig.model, messages, temperature: 0.7, max_tokens: 16000 },
        agentConfig.apiKey
      );
    } catch (err) {
      console.error("Agent chat error after retries:", err);
      return NextResponse.json({ error: "El agente no esta disponible. Intenta de nuevo en unos segundos." }, { status: 503 });
    }

    if (!agentRes.ok) {
      const errText = await agentRes.text().catch(() => "Error agente");
      console.error(`Agent error [${agentRes.status}]:`, errText);
      const errorMsg = agentRes.status === 429
        ? "El agente esta ocupado. Intenta de nuevo en unos segundos."
        : agentRes.status === 503
        ? "El agente no esta disponible temporalmente."
        : "Error al conectar con el agente.";
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const agentData = await agentRes.json();
    const response = agentData.choices?.[0]?.message?.content || "Sin respuesta del agente";

    // Save assistant message
    await prisma.chatMessage.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        projectId: projectId || null,
        role: "assistant",
        content: response,
        organizationId: organizationId || null,
        agentId,
      },
    });

    return NextResponse.json({ response });

  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
