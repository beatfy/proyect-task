import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/organizations/[id]/knowledge-base
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: authResult.userId, organizationId: id },
    });
    if (!membership) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    let kb = await prisma.knowledgeBase.findUnique({
      where: { organizationId: id },
    });

    if (!kb) {
      kb = await prisma.knowledgeBase.create({
        data: { organizationId: id, content: "" },
      });
    }

    return NextResponse.json({ content: kb.content, updatedAt: kb.updatedAt });
  } catch (error) {
    console.error("Error fetching knowledge base:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/knowledge-base
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: authResult.userId, organizationId: id },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: "Solo OWNER o ADMIN pueden editar la knowledge base" }, { status: 403 });
    }

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content : "";

    const kb = await prisma.knowledgeBase.upsert({
      where: { organizationId: id },
      create: { organizationId: id, content },
      update: { content },
    });

    return NextResponse.json({ content: kb.content, updatedAt: kb.updatedAt });
  } catch (error) {
    console.error("Error updating knowledge base:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
