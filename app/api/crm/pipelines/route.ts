import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");
    const organizationId = searchParams.get("organizationId");

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const where: Record<string, unknown> = {};
    if (pipelineId) {
      where.id = pipelineId;
    }
    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      where.organizationId = organizationId;
    } else {
      where.OR = [
        { organizationId: { in: userOrgIds } },
        { organizationId: null },
      ];
    }

    const pipelines = await prisma.pipeline.findMany({
      where,
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            _count: { select: { deals: true } },
            deals: {
              orderBy: { movedAt: "desc" },
              include: {
                contact: { select: { id: true, name: true, email: true, company: true } },
                _count: { select: { activities: true } },
              },
            },
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
