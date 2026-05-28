import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("id");
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, project: { organizationId: auth.organizationId } },
      include: {
        taskAssignees: { select: { user: { select: { name: true, email: true } } } },
        comments: { select: { content: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 },
        subtasks: { select: { id: true, title: true } },
        tags: { select: { name: true, color: true } },
      },
    });
    if (!task) return apiError("Tarea no encontrada", 404);
    return Response.json(task);
  }

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  where.project = { organizationId: auth.organizationId };

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true, title: true, description: true, status: true, priority: true, dueDate: true, createdAt: true, updatedAt: true,
      project: { select: { id: true, name: true } },
      taskAssignees: { select: { user: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return Response.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { projectId, title, description, status, priority, dueDate } = body;

  if (!projectId || !title) return apiError("projectId y title son requeridos", 400);

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: auth.organizationId },
  });
  if (!project) return apiError("Proyecto no encontrado", 404);

  const task = await prisma.task.create({
    data: {
      id: cuid(),
      title,
      description: description || null,
      status: status || "TODO",
      priority: priority || "NONE",
      dueDate: dueDate ? new Date(dueDate) : null,
      projectId,
      creatorId: "agent-system",
    },
  });

  return Response.json(task, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { id, title, description, status, priority, dueDate } = body;

  if (!id) return apiError("id es requerido", 400);

  const existing = await prisma.task.findFirst({
    where: { id, project: { organizationId: auth.organizationId } },
  });
  if (!existing) return apiError("Tarea no encontrada", 404);

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (priority !== undefined) data.priority = priority;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const task = await prisma.task.update({ where: { id }, data });

  return Response.json(task);
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return apiError("id es requerido", 400);

  const existing = await prisma.task.findFirst({
    where: { id, project: { organizationId: auth.organizationId } },
  });
  if (!existing) return apiError("Tarea no encontrada", 404);

  await prisma.task.delete({ where: { id } });

  return Response.json({ success: true });
}
