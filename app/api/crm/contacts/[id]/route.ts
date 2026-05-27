import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { verifyOrgMembership } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }

    if (contact.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, contact.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a este contacto" }, { status: 403 });
      }
    }

    const fullContact = await prisma.contact.findUnique({
      where: { id },
      include: {
        pipeline: { select: { id: true, name: true } },
        deals: {
          include: {
            stage: { select: { id: true, name: true, color: true, position: true } },
            _count: { select: { activities: true } },
          },
          orderBy: { movedAt: "desc" },
        },
        activities: {
          include: {
            deal: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(fullContact);
  } catch (error) {
    console.error("Get contact detail error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
