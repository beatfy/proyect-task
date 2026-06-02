import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
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
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        taskAssignees: { select: { user: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return Response.json({ tasks });
  } catch (error: any) {
    console.error("Error en GET /api/v1/tasks:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return apiError("El cuerpo de la petición debe ser un JSON válido", 400);
    }

    const { projectId, title, description, status, priority, dueDate } = body;

    if (!projectId || !title) return apiError("projectId y title son requeridos", 400);

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: auth.organizationId },
    });
    if (!project) return apiError("Proyecto no encontrado o no pertenece a tu organización", 404);

    let parsedDueDate: Date | null = null;
    if (dueDate) {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        return apiError("dueDate no es una fecha válida (debe ser formato ISO 8601)", 400);
      }
    }

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description: description || null,
        status: status || "TODO",
        priority: priority || "NONE",
        dueDate: parsedDueDate,
        projectId,
        creatorId: auth.userId,
      },
    });

    return Response.json(task, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/v1/tasks:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return apiError("El cuerpo de la petición debe ser un JSON válido", 400);
    }

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

    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === "") {
        data.dueDate = null;
      } else {
        const parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          return apiError("dueDate no es una fecha válida (debe ser formato ISO 8601)", 400);
        }
        data.dueDate = parsedDueDate;
      }
    }

    const task = await prisma.task.update({ where: { id }, data });

    return Response.json(task);
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/tasks:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/tasks:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}
