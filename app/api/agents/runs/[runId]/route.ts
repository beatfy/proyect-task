import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

const INNIX_BASE = process.env.INNIX_BASE || "https://agents.beatfy.net/agent";

const AGENT_CONFIG: Record<string, { path: string; apiKey: string }> = {
  "doc": {
    path: "doc",
    apiKey: process.env.INNIX_DOC_KEY || "cecb3f99b46e7e16adfa60a5d4a839b5f27d1f3e1659",
  },
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { runId } = await context.params;

    if (!runId) {
      return NextResponse.json({ error: "runId requerido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId") || "doc";
    const projectId = searchParams.get("projectId") || null;

    const agentConfig = AGENT_CONFIG[agentId];
    if (!agentConfig) {
      return NextResponse.json({ error: "Agente no reconocido" }, { status: 400 });
    }

    const runUrl = `${INNIX_BASE}/${agentConfig.path}/v1/runs/${runId}`;

    const res = await fetch(runUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${agentConfig.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error en run gateway");
      console.error(`Run gateway error [${res.status}]:`, errText);
      return NextResponse.json({ error: "Error al consultar estado del run" }, { status: res.status });
    }

    const data = await res.json();

    // If completed and has output, save assistant message in DB if not already saved
    if ((data.status === "completed" || data.completed) && data.output) {
      try {
        const existing = await prisma.chatMessage.findFirst({
          where: {
            userId: authResult.userId,
            agentId,
            role: "assistant",
            content: data.output,
          },
        });

        if (!existing) {
          let organizationId: string | null = null;
          if (projectId) {
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { organizationId: true },
            });
            if (project?.organizationId) organizationId = project.organizationId;
          }

          await prisma.chatMessage.create({
            data: {
              id: cuid(),
              userId: authResult.userId,
              projectId: projectId || null,
              role: "assistant",
              content: data.output,
              organizationId,
              agentId,
            },
          });
        }
      } catch (dbErr) {
        console.error("Error auto-saving run assistant message:", dbErr);
      }
    }

    return NextResponse.json({
      run_id: data.run_id || runId,
      status: data.status,
      completed: Boolean(data.completed || data.status === "completed"),
      output: data.output || null,
      last_event: data.last_event || null,
      usage: data.usage || null,
      runtime: data.runtime || null,
      error: data.error || null,
    });
  } catch (err: any) {
    console.error("GET run proxy error:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno al verificar run" },
      { status: 500 }
    );
  }
}
