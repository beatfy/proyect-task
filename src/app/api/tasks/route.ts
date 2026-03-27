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
        project: {
          select: { id: true, name: true, color: true }
        },
        assignee: {
          select: { id: true, name: true, email: true }
        },
        tags: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
        projectId: projectId || null,
        creatorId: session.user.id,
        assigneeId,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true }
        },
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

    const { id, status, priority, title, description, projectId, assignedTo } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (projectId !== undefined) updateData.projectId = projectId || null;

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const assignee = await prisma.user.findUnique({
          where: { email: assignedTo },
        });
        updateData.assigneeId = assignee?.id || null;
      } else {
        updateData.assigneeId = null;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true, color: true }
        },
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
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}