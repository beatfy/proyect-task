import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");

    const where: Record<string, unknown> = {};
    if (pipelineId) {
      where.id = pipelineId;
    }

    const pipelines = await prisma.pipeline.findMany({
      where,
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            _count: { select: { deals: true } },
          },
        },
        _count: { select: { deals: true, contacts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pipelines);
  } catch (error) {
    console.error("Get pipelines error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
