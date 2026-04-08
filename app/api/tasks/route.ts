import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { canAccessTask, canModifyTask } from "@/lib/authz";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/validations/task";
import { notifyTaskWebhook } from "@/lib/webhook";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const organizationId = searchParams.get("organizationId");

    const whereClause: Record<string, unknown> = {
      OR: [
        { creatorId: authResult.userId },
        { assigneeId: authResult.userId },
        { taskAssignees: { some: { userId: authResult.userId } } },
      ],
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (organizationId) {
      whereClause.project = {
        organizationId: organizationId,
      };
      if (!projectId) {
        delete whereClause.projectId;
      }
    }

    const parentId = searchParams.get("parentId");
    if (parentId) {
      delete whereClause.OR;
      whereClause.parentId = parentId;
    } else {
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
        taskAssignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        },
        tags: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTasks = tasks.map(task => ({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map(ta => ta.user),
    }));

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Get tasks error:", error);
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

    const parsed = taskCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { title, description, status, priority, dueDate, projectId, assignedTo, assigneeId, assigneeIds, parentId } = parsed.data;

    const userExists = await prisma.user.findUnique({ where: { id: authResult.userId }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "Sesión inválida. Por favor, cierra sesión y vuelve a iniciar." }, { status: 401 });
    }

    let finalAssigneeId: string | null = null;
    if (assigneeId) {
      finalAssigneeId = assigneeId;
    } else if (assignedTo) {
      const assignee = await prisma.user.findUnique({ where: { email: assignedTo } });
      finalAssigneeId = assignee?.id || null;
    }

    const finalAssigneeIds: string[] = Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [];

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description,
        status: status || "TODO",
        priority: priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        creatorId: authResult.userId,
        assigneeId: finalAssigneeId,
        parentId: parentId || null,
        taskAssignees: finalAssigneeIds.length > 0 ? {
          create: finalAssigneeIds.map(uid => ({ id: cuid(), userId: uid }))
        } : undefined,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        },
      },
    });

    // Notify multi-assignees
    for (const uid of finalAssigneeIds) {
      if (uid !== authResult.userId) {
        await prisma.notification.create({
          data: {
            id: cuid(),
            userId: uid,
            type: "TASK_ASSIGNED",
            title: `Tarea asignada: ${title}`,
            content: `Te han asignado la tarea "${title}"`,
            data: { taskId: task.id, projectId: projectId || null },
          },
        });
      }
    }

    // Legacy single assignee notification
    if (finalAssigneeId && finalAssigneeId !== authResult.userId && !finalAssigneeIds.includes(finalAssigneeId)) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: finalAssigneeId,
          type: "TASK_ASSIGNED",
          title: `Tarea asignada: ${title}`,
          content: `Te han asignado la tarea "${title}"`,
          data: { taskId: task.id, projectId: projectId || null },
        },
      });
    }

    await notifyTaskWebhook({ id: task.id, title, description, priority, dueDate: dueDate ? new Date(dueDate).toISOString() : null, assigneeId: finalAssigneeId, creatorId: authResult.userId });

    return NextResponse.json({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map(ta => ta.user),
    });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const parsed = taskUpdateSchema.safeParse(body);
    console.log(`[PATCH /api/tasks] body=`, body, `parsed=`, parsed.success ? 'OK' : parsed.error?.issues);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { id, status, priority, title, description, projectId, assignedTo, assigneeId, assigneeIds, dueDate } = parsed.data;

    const authorized = await canModifyTask(authResult.userId, id);
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

    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId || null;
    } else if (assignedTo !== undefined) {
      if (assignedTo) {
        const assignee = await prisma.user.findUnique({ where: { email: assignedTo } });
        updateData.assigneeId = assignee?.id || null;
      } else {
        updateData.assigneeId = null;
      }
    }

    // Sync multi-assignees if provided
    if (assigneeIds !== undefined) {
      const newIds: string[] = Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [];
      const current = await prisma.taskAssignee.findMany({
        where: { taskId: id },
        select: { userId: true },
      });
      const currentIds = current.map(c => c.userId);
      const toAdd = newIds.filter(uid => !currentIds.includes(uid));
      const toRemove = currentIds.filter(uid => !newIds.includes(uid));

      if (toRemove.length > 0) {
        await prisma.taskAssignee.deleteMany({
          where: { taskId: id, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await prisma.taskAssignee.createMany({
          data: toAdd.map(uid => ({ id: cuid(), taskId: id, userId: uid })),
        });
      }

      // Notify new assignees
      for (const uid of toAdd) {
        if (uid !== authResult.userId) {
          await prisma.notification.create({
            data: {
              id: cuid(),
              userId: uid,
              type: "TASK_ASSIGNED",
              title: `Tarea asignada: ${title || ''}`,
              content: `Te han asignado la tarea "${title || ''}"`,
              data: { taskId: id, projectId: projectId || null },
            },
          }).catch(() => {});
        }
      }
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: { status: true, assigneeId: true, creatorId: true, title: true },
    });

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        },
      },
    });

    if (status === "DONE" && currentTask?.status !== "DONE") {
      const notifyUserId = currentTask?.creatorId;
      if (notifyUserId && notifyUserId !== authResult.userId) {
        await prisma.notification.create({
          data: {
            id: cuid(),
            userId: notifyUserId,
            type: "TASK_COMPLETED",
            title: `Tarea completada: ${task.title}`,
            content: `"${task.title}" ha sido marcada como completada`,
            data: { taskId: task.id, projectId: task.project?.id || null },
          },
        });
      }
    }

    if (assigneeId !== undefined && assigneeId && assigneeId !== currentTask?.assigneeId) {
      if (assigneeId !== authResult.userId) {
        await prisma.notification.create({
          data: {
            id: cuid(),
            userId: assigneeId,
            type: "TASK_ASSIGNED",
            title: `Tarea asignada: ${task.title}`,
            content: `Te han asignado la tarea "${task.title}"`,
            data: { taskId: task.id, projectId: task.project?.id || null },
          },
        });
      }
    }

    if (assigneeId !== undefined && assigneeId) {
      await notifyTaskWebhook({ id, title: task.title, description: task.description, priority: priority || null, dueDate: dueDate ? new Date(dueDate).toISOString() : null, assigneeId, creatorId: authResult.userId });
    }

    return NextResponse.json({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map(ta => ta.user),
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const authorized = await canModifyTask(authResult.userId, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para eliminar esta tarea" }, { status: 403 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
