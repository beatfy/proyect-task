import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * API route que conecta el chat de agentes con OpenClaw Gateway.
 *
 * El chat NO pasa contexto automático de proyecto/cliente.
 * El agente en OpenClaw identifica el cliente y busca contexto en Obsidian/Qdrant.
 * La app solo es el frontend — el motor es OpenClaw.
 */
export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history } = await req.json();

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { error: "agentId es requerido" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message es requerido" },
        { status: 400 }
      );
    }

    // Intentar conectar con OpenClaw Gateway
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
    const authToken = process.env.OPENCLAW_AUTH_TOKEN || "";
    const bearerToken = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;

    try {
      const res = await fetch(`${gatewayUrl}/__openclaw__/api/agent/turn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: bearerToken,
        },
        body: JSON.stringify({
          agentId,
          message,
          sessionKey: `taskx2-agent-${agentId}`,
          history: Array.isArray(history) ? history.slice(-20) : [],
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout para respuestas de agentes
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Error desconocido");
        console.error(`OpenClaw Gateway error [${res.status}]:`, errorText);

        // Fallback: intentar con el endpoint /hooks/wake
        return await fallbackWake(message, agentId, bearerToken);
      }

      const data = await res.json();
      return NextResponse.json({ response: data.response || data.text || data.message || "Procesado" });
    } catch (fetchErr) {
      console.error("Gateway fetch failed, trying fallback:", fetchErr);
      return await fallbackWake(message, agentId, bearerToken);
    }
  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Fallback: usar /hooks/wake del gateway (mismo patrón que openclaw-proxy.ts)
 */
async function fallbackWake(
  message: string,
  agentId: string,
  bearerToken: string
): Promise<NextResponse> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";

  try {
    const res = await fetch(`${gatewayUrl}/hooks/wake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerToken,
      },
      body: JSON.stringify({
        text: `[Agente: ${agentId}]\n${message}`,
        mode: "now",
        sessionKey: `taskx2-agent-${agentId}`,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const text = await res.text();
    return NextResponse.json({ response: text || "Sin respuesta del agente" });
  } catch {
    // Último fallback: gateway remoto (clawd.beatfy.net)
    const remoteGateway = "https://clawd.beatfy.net";
    try {
      const res = await fetch(`${remoteGateway}/hooks/wake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: bearerToken,
        },
        body: JSON.stringify({
          text: `[Agente: ${agentId}]\n${message}`,
          mode: "now",
          sessionKey: `taskx2-agent-${agentId}`,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const text = await res.text();
      return NextResponse.json({ response: text || "Sin respuesta del agente" });
    } catch (remoteErr) {
      console.error("All gateway connections failed:", remoteErr);
      return NextResponse.json(
        { error: "No se pudo conectar con el agente. Verifica que OpenClaw Gateway esté activo." },
        { status: 502 }
      );
    }
  }
}
