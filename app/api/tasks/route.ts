import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { canAccessTask, canModifyTask } from "@/lib/authz";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/validations/task";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const whereClause: Record<string, unknown> = {
      OR: [
        { creatorId: session.user.id },
        { assigneeId: session.user.id },
      ],
    };

    // Filter by project if provided
    if (projectId) {
      whereClause.projectId = projectId;
    }

    // Filter by parentId for subtasks
    const parentId = searchParams.get("parentId");
    if (parentId) {
      whereClause.parentId = parentId;
    } else {
      // Only main tasks by default (no parentId)
      whereClause.parentId = null;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
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

    const body = await request.json();

    // Validate input with Zod
    const parsed = taskCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { title, description, status, priority, dueDate, projectId, assignedTo, assigneeId, parentId } = parsed.data;

    // Verify user exists in database
    const userExists = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "Sesión inválida. Por favor, cierra sesión y vuelve a iniciar." }, { status: 401 });
    }

    // Resolve assigneeId - can come directly or via email
    let finalAssigneeId: string | null = null;
    if (assigneeId) {
      finalAssigneeId = assigneeId;
    } else if (assignedTo) {
      const assignee = await prisma.user.findUnique({
        where: { email: assignedTo },
      });
      finalAssigneeId = assignee?.id || null;
    }

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description,
        status: status || "TODO",
        priority: priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        creatorId: session.user.id,
        assigneeId: finalAssigneeId,
        parentId: parentId || null,
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

    const body = await request.json();

    // Validate input with Zod
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { id, status, priority, title, description, projectId, assignedTo, assigneeId, dueDate } = parsed.data;

    // Authorization: user must be able to modify this task
    const authorized = await canModifyTask(session.user.id, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta tarea" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (projectId !== undefined) updateData.projectId = projectId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    // Resolve assigneeId
    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId || null;
    } else if (assignedTo !== undefined) {
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

    // Authorization: user must be able to modify (delete) this task
    const authorized = await canModifyTask(session.user.id, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para eliminar esta tarea" }, { status: 403 });
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
