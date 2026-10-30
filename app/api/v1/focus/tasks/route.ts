import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";
import { buildFocusQueue } from "@/lib/focus";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

    const { searchParams } = new URL(request.url);
    const energyFilter = searchParams.get("energy"); // low|medium|high

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        status: {
          notIn: ["DONE", "completed"],
        },
        project: { organizationId: auth.organizationId },
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
    });

    const filtered = buildFocusQueue(tasks, { energyFilter });
    return Response.json({ tasks: filtered });
  } catch (error: unknown) {
    console.error("Error en GET /api/v1/focus/tasks:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return apiError(msg, 500);
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

    const {
      title,
      description,
      projectId,
      emotionalWeight,
      timeBlock,
      energyRequired,
      blocksSomeone,
      dopamineSource,
      blockReason,
      status = "TODO",
      tdahMetrics: inputTdahMetrics,
    } = body;

    if (!title) return apiError("El campo title es requerido", 400);

    let targetProjectId = projectId || null;
    if (targetProjectId) {
      const proj = await prisma.project.findFirst({
        where: { id: targetProjectId, organizationId: auth.organizationId },
      });
      if (!proj) return apiError("Proyecto no encontrado o no pertenece a tu organización", 404);
    } else {
      const defaultProj = await prisma.project.findFirst({
        where: { organizationId: auth.organizationId },
      });
      targetProjectId = defaultProj?.id || null;
    }

    // Procrastination limit check (max 3 planning tasks)
    if (status === "planning") {
      const count = await prisma.task.count({
        where: {
          creatorId: auth.userId,
          status: "planning",
        },
      });
      if (count >= 3) {
        return apiError(
          "Demasiadas tareas en planificación. Termina una primero (límite de 3).",
          400
        );
      }
    }

    const finalBlockReason = blockReason || inputTdahMetrics?.blockReason || null;

    const tdahMetrics = {
      emotionalWeight: typeof emotionalWeight === "number" ? emotionalWeight : 3,
      baseWeight: typeof emotionalWeight === "number" ? emotionalWeight : 3,
      energyRequired: energyRequired || "medium",
      timeBlock: timeBlock || "30min",
      blocksSomeone: !!blocksSomeone,
      dopamineSource: dopamineSource || "routine",
      lastTouched: new Date().toISOString(),
      streakDays: 0,
      blockReason: finalBlockReason,
    };

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description: description || null,
        status,
        projectId: targetProjectId,
        creatorId: auth.userId,
        tdahMetrics,
      },
    });

    return Response.json(task, { status: 201 });
  } catch (error: unknown) {
    console.error("Error en POST /api/v1/focus/tasks:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return apiError(msg, 500);
  }
}
