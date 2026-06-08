import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError("El cuerpo de la petición debe ser un JSON válido", 400);
    }

    const existing = await prisma.task.findFirst({
      where: { id, project: { organizationId: auth.organizationId } }
    });
    if (!existing) return apiError("Tarea no encontrada", 404);

    const {
      title,
      description,
      emotionalWeight,
      timeBlock,
      energyRequired,
      blocksSomeone,
      dopamineSource,
      status
    } = body;

    // Procrastination limit check
    if (status === "planning" && existing.status !== "planning") {
      const count = await prisma.task.count({
        where: {
          creatorId: auth.userId,
          status: "planning",
          id: { not: id }
        }
      });
      if (count >= 3) {
        return apiError("Demasiadas tareas en planificación. Termina una primero (límite de 3).", 400);
      }
    }

    // Merge or update tdahMetrics
    let currentMetrics: Record<string, any> = {};
    if (existing.tdahMetrics && typeof existing.tdahMetrics === "object") {
      currentMetrics = { ...(existing.tdahMetrics as Record<string, any>) };
    }

    const updatedMetrics = { ...currentMetrics };
    if (emotionalWeight !== undefined) {
      updatedMetrics.emotionalWeight = emotionalWeight;
      updatedMetrics.baseWeight = emotionalWeight;
    }
    if (energyRequired !== undefined) updatedMetrics.energyRequired = energyRequired;
    if (timeBlock !== undefined) updatedMetrics.timeBlock = timeBlock;
    if (blocksSomeone !== undefined) updatedMetrics.blocksSomeone = !!blocksSomeone;
    if (dopamineSource !== undefined) updatedMetrics.dopamineSource = dopamineSource;

    // Mark as touched on any updates
    updatedMetrics.lastTouched = new Date().toISOString();
    updatedMetrics.streakDays = 0;

    const data: Record<string, any> = {
      tdahMetrics: updatedMetrics
    };

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;

    // Support ADHD progress status mappings
    if (status !== undefined) {
      if (status === "hecha" || status === "completed" || status === "DONE") {
        data.status = "DONE";
      } else if (status === "aliviada") {
        const newWeight = Math.max(1, (updatedMetrics.emotionalWeight || 3) - 2);
        updatedMetrics.emotionalWeight = newWeight;
        updatedMetrics.baseWeight = newWeight;
        data.tdahMetrics = updatedMetrics;
      } else if (status === "sigue_pesando") {
        const newWeight = Math.min(5, (updatedMetrics.emotionalWeight || 3) + 0.5);
        updatedMetrics.emotionalWeight = newWeight;
        updatedMetrics.baseWeight = newWeight;
        data.tdahMetrics = updatedMetrics;
      } else {
        data.status = status;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true, color: true } }
      }
    });

    return Response.json(updatedTask);
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/focus/tasks/[id]:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    const { id } = await params;

    const existing = await prisma.task.findFirst({
      where: { id, project: { organizationId: auth.organizationId } }
    });
    if (!existing) return apiError("Tarea no encontrada", 404);

    await prisma.task.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/focus/tasks/[id]:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}
