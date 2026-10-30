import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const labelCreateSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  organizationId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (organizationId) {
      const { valid: isMember } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!isMember) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const userOrgIds = organizationId ? [] : await getUserOrgIds(authResult.userId);

    const labels = await prisma.label.findMany({
      where: organizationId
        ? { organizationId }
        : {
            OR: [
              { organizationId: null },
              ...(userOrgIds.length > 0 ? [{ organizationId: { in: userOrgIds } }] : []),
            ],
          },
      include: { _count: { select: { projects: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("Get labels error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = labelCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (parsed.data.organizationId) {
      const { valid: isMember } = await verifyOrgMembership(authResult.userId, parsed.data.organizationId);
      if (!isMember) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const label = await prisma.label.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color || "#6366f1",
        organizationId: parsed.data.organizationId || null,
      },
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe una etiqueta con ese nombre" }, { status: 409 });
    }
    console.error("Create label error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
