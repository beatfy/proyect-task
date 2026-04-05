import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

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

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authResult.userId,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
    }

    const projects = await prisma.project.findMany({
      where: { organizationId: id },
      include: {
        members: true,
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Get org projects error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authResult.userId,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, color } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    // Get all org members to auto-add to project
    const orgMembers = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      select: { userId: true },
    });

    const projectId = cuid();

    const project = await prisma.project.create({
      data: {
        id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#6366f1",
        organizationId: id,
        members: {
          create: [
            // Creator as OWNER
            {
              id: cuid(),
              userId: authResult.userId,
              role: "OWNER",
            },
            // All other org members as MEMBER
            ...orgMembers
              .filter((m) => m.userId !== session.user!.id)
              .map((m) => ({
                id: cuid(),
                userId: m.userId,
                role: "MEMBER" as const,
              })),
          ],
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Create org project error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
