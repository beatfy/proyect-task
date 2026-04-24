import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, email: true, company: true } },
        stage: { select: { id: true, name: true, color: true, position: true } },
        pipeline: { select: { id: true, name: true } },
        activities: {
          include: {
            contact: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error("Get deal detail error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
