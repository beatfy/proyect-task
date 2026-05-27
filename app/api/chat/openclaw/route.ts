import { NextRequest, NextResponse } from "next/server";
import { sendToLedy } from "@/lib/openclaw-proxy";
import { authenticateRequest } from "@/lib/api-auth";
import { aiRateLimit } from "@/lib/ai-rate-limit";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rateCheck = await aiRateLimit(authResult.userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite de mensajes. Espera un momento.", remaining: rateCheck.remaining },
        { status: 429 }
      );
    }

    const { message, projectId, organizationId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const response = await sendToLedy(message, authResult.userId, projectId, organizationId);

    return NextResponse.json({ response });
  } catch (err) {
    console.error("OpenClaw proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach OpenClaw" },
      { status: 502 }
    );
  }
}
