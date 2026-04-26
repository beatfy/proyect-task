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
          select: { id: true, name: true, description: true },
        });
        if (project) {
          clientContext = `\n\n---\n[SISTEMA] El usuario te habla sobre su cliente "${project.name}"${project.description ? ` (${project.description})` : ""}. IMPORTANTE: Busca en tu memoria (search.py Qdrant) toda la info de este cliente. Responde SOBRE EL CLIENTE, no sobre ti mismo. No menciones tu configuración interna ni archivos del sistema.]`;
        }
      } catch (dbErr) {
        console.error("DB lookup error:", dbErr);
      }
    }

    // Construir mensajes
    const messages: Array<{ role: string; content: string }> = [];

    // Añadir historial (últimos 20 mensajes)
    if (Array.isArray(history) && history.length > 0) {
      const contextMsg = history.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      messages.push(...contextMsg);
    }

    // Añadir mensaje actual con contexto del cliente
    const finalMessage = clientContext
      ? `${message}${clientContext}`
      : message;

    messages.push({ role: "user", content: finalMessage });

    const model = `openclaw/${agentId}`;

    const gatewayRes = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(120000) // 2 minutes timeout for agent response
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text().catch(() => "Error gateway");
      console.error(`Gateway error [${gatewayRes.status}]:`, errText);
      const errorMsg = gatewayRes.status === 429 
        ? "El agente está ocupado. Intenta de nuevo en unos segundos."
        : gatewayRes.status === 503 
        ? "El agente no está disponible temporalmente."
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
