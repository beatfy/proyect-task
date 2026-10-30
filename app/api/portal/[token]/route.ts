import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const tokenRecord = await prisma.projectInviteToken.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            status: true,
            clientEmail: true,
            clientContext: true,
            createdAt: true,
            taskPipelines: {
              where: { isDefault: true },
              include: {
                stages: { orderBy: { position: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!tokenRecord || tokenRecord.role !== "CLIENT" || !tokenRecord.project) {
      return NextResponse.json({ error: "Portal no encontrado o enlace inválido" }, { status: 404 });
    }

    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: "El enlace de acceso ha expirado" }, { status: 410 });
    }

    const projectId = tokenRecord.projectId;

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        status: { not: "ARCHIVED" },
        parentId: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        stage: {
          select: { id: true, name: true, color: true, position: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const invoices = await prisma.invoice.findMany({
      where: { projectId },
      select: {
        id: true,
        month: true,
        year: true,
        amount: true,
        status: true,
        dueDate: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    // Increment view count non-blocking
    prisma.projectInviteToken
      .update({
        where: { id: tokenRecord.id },
        data: { uses: { increment: 1 } },
      })
      .catch(() => {});

    return NextResponse.json({
      project: tokenRecord.project,
      tasks,
      invoices,
    });
  } catch (error) {
    console.error("Portal fetch error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
