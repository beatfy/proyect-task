import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessTask, canModifyTask } from "@/lib/authz";
import { taskUpdateSchema } from "@/lib/validations/task";
import { resolveTaskStageAndStatus } from "@/lib/task-status";
import { recordTaskAudit, TaskChange } from "@/lib/task-audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[id]
 * Returns full task details, including audit logs, subtasks, assignees, and attachments.
 * Always returns JSON (never 404 HTML).
 */
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
    if (!id) {
      return NextResponse.json({ error: "ID de tarea requerido" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, color: true, organizationId: true },
        },
        stage: {
          select: { id: true, name: true, color: true, position: true },
        },
        pipeline: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        taskAssignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        subtasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
        attachments: {
          select: { id: true, name: true, url: true, type: true, size: true, createdAt: true },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const hasAccess = await canAccessTask(authResult.userId, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "No tienes permiso para ver esta tarea" }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Error interno al obtener la tarea" }, { status: 500 });
  }
}

/**
 * PATCH /api/tasks/[id]
 * Updates a task by ID from route parameters.
 * Supports numeric priority (1..5), canonical statuses, polymorphic stages,
 * and tracks changes in TaskAuditLog. Always returns JSON.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID de tarea requerido" }, { status: 400 });
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: {
        stage: true,
        taskAssignees: true,
      },
    });

    if (!currentTask) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const canModify = await canModifyTask(authResult.userId, id);
    if (!canModify) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta tarea" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parsed.data;

    // Normalizar status y stage para eliminar la trampa polimórfica
    let finalStatus = currentTask.status;
    let finalStageId = currentTask.stageId;
    let finalPipelineId = currentTask.pipelineId;

    if (data.status !== undefined || data.stageId !== undefined || data.pipelineId !== undefined) {
      const resolved = await resolveTaskStageAndStatus(prisma, {
        rawStatus: data.status,
        rawStageId: data.stageId,
        pipelineId: data.pipelineId || currentTask.pipelineId,
        projectId: data.projectId !== undefined ? data.projectId : currentTask.projectId,
        organizationId: data.organizationId !== undefined ? data.organizationId : currentTask.organizationId,
      });

      if (data.status !== undefined) finalStatus = resolved.status;
      if (data.stageId !== undefined || resolved.stageId) finalStageId = resolved.stageId;
      if (resolved.pipelineId) finalPipelineId = resolved.pipelineId;
    }

    // Prepare update data
    const updatePayload: Record<string, any> = {};
    const changes: TaskChange[] = [];

    if (data.title !== undefined && data.title !== currentTask.title) {
      changes.push({ field: "title", oldValue: currentTask.title, newValue: data.title });
      updatePayload.title = data.title;
    }

    if (data.description !== undefined && data.description !== currentTask.description) {
      changes.push({ field: "description", oldValue: currentTask.description, newValue: data.description });
      updatePayload.description = data.description;
    }

    if (finalStatus !== currentTask.status) {
      changes.push({ field: "status", oldValue: currentTask.status, newValue: finalStatus });
      updatePayload.status = finalStatus;
    }

    if (data.priority !== undefined && data.priority !== currentTask.priority) {
      changes.push({ field: "priority", oldValue: currentTask.priority, newValue: data.priority });
      updatePayload.priority = data.priority;
    }

    if (finalStageId !== currentTask.stageId) {
      changes.push({ field: "stageId", oldValue: currentTask.stageId, newValue: finalStageId });
      updatePayload.stageId = finalStageId;
    }

    if (finalPipelineId !== currentTask.pipelineId) {
      updatePayload.pipelineId = finalPipelineId;
    }

    if (data.dueDate !== undefined) {
      const parsedDate = data.dueDate ? new Date(data.dueDate) : null;
      changes.push({ field: "dueDate", oldValue: currentTask.dueDate?.toISOString(), newValue: parsedDate?.toISOString() });
      updatePayload.dueDate = parsedDate;
    }

    if (data.projectId !== undefined && data.projectId !== currentTask.projectId) {
      changes.push({ field: "projectId", oldValue: currentTask.projectId, newValue: data.projectId });
      updatePayload.projectId = data.projectId;
    }

    if (data.assigneeId !== undefined && data.assigneeId !== currentTask.assigneeId) {
      changes.push({ field: "assigneeId", oldValue: currentTask.assigneeId, newValue: data.assigneeId });
      updatePayload.assigneeId = data.assigneeId;
    }

    if (data.tdahMetrics !== undefined) {
      updatePayload.tdahMetrics = data.tdahMetrics;
    }

    // Execute update and audit log inside transaction
    const updatedTask = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: updatePayload,
        include: {
          stage: true,
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      if (changes.length > 0) {
        await recordTaskAudit(tx, {
          taskId: id,
          userId: authResult.userId,
          action: "UPDATE",
          changes,
        });
      }

      return task;
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Error interno al actualizar la tarea" }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id]
 * Deletes a task by ID from route parameters.
 * Does not require a JSON body, but accepts one if provided.
 * Always returns JSON (never 404 HTML).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID de tarea requerido" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const canModify = await canModifyTask(authResult.userId, id);
    if (!canModify) {
      return NextResponse.json({ error: "No tienes permisos para eliminar esta tarea" }, { status: 403 });
    }

    // Delete task (Prisma handles Cascade for TaskAssignee, Comments, Attachments, TaskAuditLog)
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      id,
      message: "Tarea eliminada correctamente",
    });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Error interno al eliminar la tarea" }, { status: 500 });
  }
}
