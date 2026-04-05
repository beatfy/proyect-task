import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { projectCreateSchema } from "@/lib/validations/project";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const whereClause: Record<string, unknown> = {
      members: {
        some: { userId: authResult.userId },
      },
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        members: true,
        tasks: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verify user exists in database
    const userExists = await prisma.user.findUnique({ where: { id: authResult.userId }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "Sesión inválida. Por favor, cierra sesión y vuelve a iniciar." }, { status: 401 });
    }

    const body = await request.json();

    // Validate input with Zod
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { name, description, color } = parsed.data;
    const organizationId = body.organizationId as string | undefined;

    const projectId = cuid();

    // If creating within an org, auto-add all org members
    let membersCreate: Array<{ id: string; userId: string; role: string }> = [
      {
        id: cuid(),
        userId: authResult.userId,
        role: "OWNER",
      },
    ];

    if (organizationId) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId },
        select: { userId: true },
      });
      membersCreate = [
        {
          id: cuid(),
          userId: authResult.userId,
          role: "OWNER",
        },
        ...orgMembers
          .filter((m) => m.userId !== authResult.userId)
          .map((m) => ({
            id: cuid(),
            userId: m.userId,
            role: "MEMBER",
          })),
      ];
    }

    const project = await prisma.project.create({
      data: {
        id: projectId,
        name,
        description,
        color: color || "#6366f1",
        organizationId: organizationId || null,
        members: {
          create: membersCreate,
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
