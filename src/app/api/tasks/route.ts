import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { creatorId: session.user.id },
          { assigneeId: session.user.id },
        ],
      },
      include: {
        project: true,
        assignee: {
          select: { id: true, name: true, email: true }
        },
        tags: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform for frontend compatibility
    const formattedTasks = tasks.map(task => ({
      ...task,
      assignedTo: task.assignee?.email || null,
    }));

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { title, description, status, priority, dueDate, projectId, assignedTo } = await request.json();

    // Find user by email if assignedTo is provided
    let assigneeId: string | null = null;
    if (assignedTo) {
      const assignee = await prisma.user.findUnique({
        where: { email: assignedTo },
      });
      assigneeId = assignee?.id || null;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || "TODO",
        priority: priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        creatorId: session.user.id,
        assigneeId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
      },
    });

    return NextResponse.json({
      ...task,
      assignedTo: task.assignee?.email || null,
    });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, status, priority, title, description } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}