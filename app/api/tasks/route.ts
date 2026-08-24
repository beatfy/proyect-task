import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { canAccessTask, canModifyTask } from "@/lib/authz";
import { canAccessProject, getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/validations/task";
import { notifyTaskWebhook } from "@/lib/webhook";
import { put } from "@vercel/blob";
import { jsPDF } from "jspdf";

const LONG_DESC_THRESHOLD = 200;
const SHORT_DESC_LENGTH = 100;

/**
 * If description is long, generate a PDF and upload as attachment.
 * Returns the (possibly shortened) description.
 */
async function maybeConvertLongDescription(
  description: string,
  taskId: string
): Promise<string> {
  if (description.length <= LONG_DESC_THRESHOLD) return description;

  const shortDesc = description.slice(0, SHORT_DESC_LENGTH) + "... [ver archivo adjunto]";
  const filename = `descripcion-${taskId}.pdf`;
  const key = `task-attachments/${taskId}/${filename}`;

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const lines = description.split("\n");
    for (const line of lines) {
      // Handle headings (# ## ###)
      const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const fontSize = level === 1 ? 18 : level === 2 ? 15 : 13;
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", "bold");
        const wrapped = doc.splitTextToSize(text, maxWidth);
        if (y + fontSize > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrapped, margin, y);
        y += fontSize * wrapped.length * 0.5 + 4;
      } else {
        // Process inline **bold**
        doc.setFontSize(11);
        let x = margin;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        for (const part of parts) {
          const boldMatch = part.match(/^\*\*(.+)\*\*$/);
          if (boldMatch) {
            doc.setFont("helvetica", "bold");
            const wrapped = doc.splitTextToSize(boldMatch[1], maxWidth - (x - margin));
            for (const wline of wrapped) {
              if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; x = margin; }
              doc.text(wline, x, y);
              x += doc.getTextWidth(wline);
            }
          } else if (part) {
            doc.setFont("helvetica", "normal");
            const wrapped = doc.splitTextToSize(part, maxWidth - (x - margin));
            for (let i = 0; i < wrapped.length; i++) {
              if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; x = margin; }
              if (i > 0) x = margin;
              doc.text(wrapped[i], x, y);
              x += doc.getTextWidth(wrapped[i]);
            }
          }
        }
        y += 6;
      }
    }

    const pdfBytes = doc.output("arraybuffer");
    const blob = await put(key, Buffer.from(pdfBytes), {
      access: "private",
    });
    await prisma.attachment.create({
      data: {
        id: cuid(),
        name: filename,
        url: blob.url,
        type: "pdf",
        size: pdfBytes.byteLength,
        taskId,
      },
    });
  } catch (error) {
    console.error("Failed to convert long description to PDF:", error);
    return description;
  }

  return shortDesc;
}

function getCanonicalStatus(
  statusOrStageId?: string | null,
  stageName?: string | null,
  position?: number | null
): string {
  const val = (statusOrStageId || "").toUpperCase().trim();
  if (val === "DONE" || val === "HECHO" || val === "COMPLETED" || val === "COMPLETADO") return "DONE";
  if (val === "INREVIEW" || val === "IN_REVIEW" || val === "REVISION" || val === "REVISIÓN") return "INREVIEW";
  if (val === "INPROGRESS" || val === "IN_PROGRESS" || val === "PROGRESO" || val === "EN PROGRESO") return "INPROGRESS";
  if (val === "PLANNING") return "PLANNING";
  if (val === "TODO" || val === "POR HACER" || val === "PENDING") return "TODO";

  const sName = (stageName || "").toLowerCase().trim();
  if (sName.includes("hecho") || sName.includes("done") || sName.includes("completad") || sName.includes("finalizad") || position === 3) return "DONE";
  if (sName.includes("revis") || position === 2) return "INREVIEW";
  if (sName.includes("progres") || position === 1) return "INPROGRESS";
  return "TODO";
}

async function syncPipelineAndStage(
  tx: any,
  data: {
    projectId?: string | null;
    organizationId?: string | null;
    pipelineId?: string | null;
    stageId?: string | null;
    status?: string | null;
  }
) {
  let pipelineId = data.pipelineId;
  let stageId = data.stageId;
  const status = data.status || "TODO";

  if (stageId) {
    const stageObj = await tx.taskPipelineStage.findUnique({
      where: { id: stageId },
      select: { pipelineId: true },
    });
    if (stageObj) {
      pipelineId = stageObj.pipelineId;
    }
    return { pipelineId, stageId };
  }

  const where: Record<string, any> = {};
  if (data.projectId) {
    where.projectId = data.projectId;
  } else if (data.organizationId) {
    where.organizationId = data.organizationId;
    where.projectId = null;
  } else {
    where.projectId = null;
    where.organizationId = null;
  }

  let pipeline = await tx.taskPipeline.findFirst({
    where,
    include: { stages: { orderBy: { position: "asc" } } },
  });

  if (!pipeline) {
    let pipelineName = "General";
    if (data.projectId) {
      const proj = await tx.project.findUnique({ where: { id: data.projectId } });
      if (proj) pipelineName = `Tablero ${proj.name}`;
    }

    const defaultStages = [
      { name: "Por hacer", color: "#64748b", position: 0 },
      { name: "En progreso", color: "#3b82f6", position: 1 },
      { name: "En revisión", color: "#eab308", position: 2 },
      { name: "Hecho", color: "#22c55e", position: 3 },
    ];

    pipeline = await tx.taskPipeline.create({
      data: {
        id: cuid(),
        name: pipelineName,
        isDefault: true,
        projectId: data.projectId || null,
        organizationId: data.organizationId || null,
        stages: {
          create: defaultStages.map((stage) => ({
            id: cuid(),
            name: stage.name,
            color: stage.color,
            position: stage.position,
          })),
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });
  }

  let stage = pipeline.stages.find((s: any) => s.id === status);
  if (!stage) {
    const statusMap: Record<string, number> = {
      TODO: 0,
      INPROGRESS: 1,
      INREVIEW: 2,
      DONE: 3,
    };
    const targetPos = statusMap[status.toUpperCase()] ?? 0;
    stage = pipeline.stages[targetPos] || pipeline.stages[0];
  }

  return {
    pipelineId: pipeline.id,
    stageId: stage ? stage.id : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const organizationId = searchParams.get("organizationId");

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const whereClause: Record<string, unknown> = {};

    if (projectId) {
      const hasAccess = await canAccessProject(authResult.userId, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
      whereClause.projectId = projectId;
    } else if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      whereClause.project = { organizationId };
    } else {
      whereClause.OR = [
        { creatorId: authResult.userId },
        { assigneeId: authResult.userId },
        { taskAssignees: { some: { userId: authResult.userId } } },
        { project: { organizationId: { in: userOrgIds } } },
      ];
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
        stage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTasks = tasks.map((task: { assignee?: { email: string } | null; taskAssignees: { user: unknown }[]; [key: string]: unknown }) => ({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map((ta: { user: unknown }) => ta.user),
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

    const { title, description, status, priority, dueDate, projectId, assignedTo, assigneeId, assigneeIds, parentId, organizationId, pipelineId, stageId, tdahMetrics } = parsed.data;

    const { pipelineId: finalPipelineId, stageId: finalStageId } = await syncPipelineAndStage(prisma, {
      projectId: projectId || null,
      organizationId: organizationId || null,
      pipelineId: pipelineId || null,
      stageId: stageId || null,
      status: status || "TODO",
    });

    const userExists = await prisma.user.findUnique({ where: { id: authResult.userId }, select: { id: true } });
    if (!userExists) {
      return NextResponse.json({ error: "Sesión inválida. Por favor, cierra sesión y vuelve a iniciar." }, { status: 401 });
    }

    if (projectId) {
      const hasAccess = await canAccessProject(authResult.userId, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }
    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    let finalAssigneeId: string | null = null;
    if (assigneeId) {
      finalAssigneeId = assigneeId;
    } else if (assignedTo) {
      const assignee = await prisma.user.findUnique({ where: { email: assignedTo } });
      finalAssigneeId = assignee?.id || null;
    }

    const finalAssigneeIds: string[] = Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [];

    if (status === "planning") {
      const count = await prisma.task.count({
        where: {
          creatorId: authResult.userId,
          status: "planning"
        }
      });
      if (count >= 3) {
        return NextResponse.json({ error: "Demasiadas tareas en planificación. Termina una primero." }, { status: 400 });
      }
    }

    let createStageObj = null;
    if (finalStageId) {
      createStageObj = await prisma.taskPipelineStage.findUnique({
        where: { id: finalStageId },
        select: { name: true, position: true },
      });
    }
    const createCanonicalStatus = getCanonicalStatus(status, createStageObj?.name, createStageObj?.position);

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description,
        status: createCanonicalStatus,
        priority: priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        creatorId: authResult.userId,
        assigneeId: finalAssigneeId,
        organizationId: organizationId || null,
        parentId: parentId || null,
        pipelineId: finalPipelineId || null,
        stageId: finalStageId || null,
        tdahMetrics: tdahMetrics || null,
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
        stage: true,
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

    // Auto-convert long descriptions to attachments
    if (task.description && task.description.length > LONG_DESC_THRESHOLD) {
      const shortDesc = await maybeConvertLongDescription(task.description, task.id);
      await prisma.task.update({ where: { id: task.id }, data: { description: shortDesc } });
      task.description = shortDesc;
    }

    await notifyTaskWebhook({
      id: task.id, title, description: task.description, priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      assigneeId: finalAssigneeId, assigneeEmail: assignedTo || null,
      creatorId: authResult.userId,
      taskAssignees: task.taskAssignees?.map((ta: { user?: { id: string; email: string } | null; userId: string }) => ({ id: ta.user?.id, email: ta.user?.email, userId: ta.userId })),
    });

    return NextResponse.json({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map((ta: { user: unknown }) => ta.user),
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
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { id, status, priority, title, description, projectId, assignedTo, assigneeId, assigneeIds, dueDate, organizationId, pipelineId, stageId, tdahMetrics } = parsed.data;

    const authorized = await canModifyTask(authResult.userId, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta tarea" }, { status: 403 });
    }

    if (status === "planning") {
      const count = await prisma.task.count({
        where: {
          creatorId: authResult.userId,
          status: "planning",
          id: { not: id }
        }
      });
      if (count >= 3) {
        return NextResponse.json({ error: "Demasiadas tareas en planificación. Termina una primero." }, { status: 400 });
      }
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: { 
        projectId: true, 
        organizationId: true, 
        pipelineId: true, 
        stageId: true, 
        status: true,
        assigneeId: true,
        creatorId: true,
        title: true,
      },
    });

    let finalPipelineId = pipelineId;
    let finalStageId = stageId;

    if (stageId !== undefined || pipelineId !== undefined || status !== undefined) {
      const syncResult = await syncPipelineAndStage(prisma, {
        projectId: projectId !== undefined ? projectId : currentTask?.projectId,
        organizationId: organizationId !== undefined ? organizationId : currentTask?.organizationId,
        pipelineId: pipelineId !== undefined ? pipelineId : currentTask?.pipelineId,
        stageId: stageId !== undefined ? stageId : currentTask?.stageId,
        status: status !== undefined ? status : currentTask?.status,
      });
      finalPipelineId = syncResult.pipelineId;
      finalStageId = syncResult.stageId;
    }

    let stageObj = null;
    if (finalStageId) {
      stageObj = await prisma.taskPipelineStage.findUnique({
        where: { id: finalStageId },
        select: { name: true, position: true },
      });
    }

    const canonicalStatus = getCanonicalStatus(status, stageObj?.name, stageObj?.position);

    const updateData: Record<string, unknown> = {};
    if (status !== undefined || finalStageId !== undefined) {
      updateData.status = canonicalStatus;
    }
    if (finalPipelineId !== undefined) updateData.pipelineId = finalPipelineId || null;
    if (finalStageId !== undefined) updateData.stageId = finalStageId || null;
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (projectId !== undefined) updateData.projectId = projectId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (organizationId !== undefined) updateData.organizationId = organizationId || null;
    if (tdahMetrics !== undefined) updateData.tdahMetrics = tdahMetrics || null;

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
      const currentIds = current.map((c: { userId: string }) => c.userId);
      const toAdd = newIds.filter((uid: string) => !currentIds.includes(uid));
      const toRemove = currentIds.filter((uid: string) => !newIds.includes(uid));

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


    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        },
        stage: true,
      },
    });

    // Auto-convert long descriptions to attachments on update
    if (description !== undefined && description !== null && description.length > LONG_DESC_THRESHOLD) {
      const shortDesc = await maybeConvertLongDescription(description, id);
      updateData.description = shortDesc;
      // Re-fetch with updated description
      const updated = await prisma.task.findUnique({ where: { id } });
      if (updated) task.description = shortDesc;
    }

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

    // Webhook: check both legacy assigneeId and multi-assignees
    const webhookAssignees = task.taskAssignees?.map((ta: { user?: { id: string; email: string } | null; userId: string }) => ({ id: ta.user?.id, email: ta.user?.email, userId: ta.userId }));
    const hasAssigneeChanges = (assigneeId !== undefined && assigneeId) || (assigneeIds !== undefined);
    if (hasAssigneeChanges) {
      await notifyTaskWebhook({
        id, title: task.title, description: task.description,
        priority: priority || null, dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId || task.assignee?.id || null,
        assigneeEmail: assignedTo || task.assignee?.email || null,
        creatorId: authResult.userId,
        taskAssignees: webhookAssignees,
      });
    }

    return NextResponse.json({
      ...task,
      assignedTo: task.assignee?.email || null,
      assignees: task.taskAssignees.map((ta: { user: unknown }) => ta.user),
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
