import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

    const { searchParams } = new URL(request.url);
    const energyFilter = searchParams.get("energy"); // low|medium|high

    // Fetch all pending tasks in the organization
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        status: {
          notIn: ["DONE", "completed"]
        },
        project: { organizationId: auth.organizationId }
      },
      include: {
        project: { select: { id: true, name: true, color: true } }
      }
    });

    const now = new Date();
    const processedTasks = tasks.map((task) => {
      let metrics: Record<string, any> = {};
      if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
        metrics = { ...(task.tdahMetrics as Record<string, any>) };
      }

      // Default values if not present
      const baseWeight = typeof metrics.emotionalWeight === "number" ? metrics.emotionalWeight : 1;
      const energyRequired = metrics.energyRequired || "medium";
      const timeBlock = metrics.timeBlock || "30min";
      const blocksSomeone = !!metrics.blocksSomeone;
      const dopamineSource = metrics.dopamineSource || "routine";
      const lastTouchedStr = metrics.lastTouched || task.updatedAt.toISOString();
      const blockReason = metrics.blockReason || null;
      
      const lastTouchedDate = new Date(lastTouchedStr);
      const diffTime = Math.abs(now.getTime() - lastTouchedDate.getTime());
      const streakDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Auto-escalation: +0.5 weight per day untouched (max 5)
      const emotionalWeight = Math.min(5, baseWeight + 0.5 * streakDays);
      const isPromoted = streakDays > 3 && blocksSomeone;

      return {
        ...task,
        tdahMetrics: {
          emotionalWeight,
          baseWeight,
          energyRequired,
          timeBlock,
          blocksSomeone,
          dopamineSource,
          lastTouched: lastTouchedStr,
          streakDays,
          isPromoted,
          blockReason
        }
      };
    });

    let filtered = processedTasks;
    if (energyFilter) {
      filtered = processedTasks.filter(
        (t) => t.tdahMetrics.energyRequired === energyFilter
      );
    }

    // Sort by Focus Queue rules
    filtered.sort((a, b) => {
      if (a.tdahMetrics.isPromoted && !b.tdahMetrics.isPromoted) return -1;
      if (!a.tdahMetrics.isPromoted && b.tdahMetrics.isPromoted) return 1;

      if (b.tdahMetrics.emotionalWeight !== a.tdahMetrics.emotionalWeight) {
        return b.tdahMetrics.emotionalWeight - a.tdahMetrics.emotionalWeight;
      }
      if (b.tdahMetrics.streakDays !== a.tdahMetrics.streakDays) {
        return b.tdahMetrics.streakDays - a.tdahMetrics.streakDays;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return Response.json({ tasks: filtered });
  } catch (error: any) {
    console.error("Error en GET /api/v1/focus/tasks:", error);
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

    const {
      title,
      description,
      projectId,
      emotionalWeight,
      timeBlock,
      energyRequired,
      blocksSomeone,
      dopamineSource,
      blockReason, // Extract blockReason from root
      status = "TODO",
      tdahMetrics: inputTdahMetrics // Extract optional nested metrics
    } = body;

    if (!title) return apiError("El campo title es requerido", 400);

    // If project is supplied, verify it belongs to the organization
    let targetProjectId = projectId || null;
    if (targetProjectId) {
      const proj = await prisma.project.findFirst({
        where: { id: targetProjectId, organizationId: auth.organizationId }
      });
      if (!proj) return apiError("Proyecto no encontrado o no pertenece a tu organización", 404);
    } else {
      // Find default project in organization if any
      const defaultProj = await prisma.project.findFirst({
        where: { organizationId: auth.organizationId }
      });
      targetProjectId = defaultProj?.id || null;
    }

    // Procrastination limit check (max 3 planning tasks)
    if (status === "planning") {
      const count = await prisma.task.count({
        where: {
          creatorId: auth.userId,
          status: "planning"
        }
      });
      if (count >= 3) {
        return apiError("Demasiadas tareas en planificación. Termina una primero (límite de 3).", 400);
      }
    }

    const finalBlockReason = blockReason || inputTdahMetrics?.blockReason || null;

    // Construct tdahMetrics object
    const tdahMetrics = {
      emotionalWeight: typeof emotionalWeight === "number" ? emotionalWeight : 3,
      baseWeight: typeof emotionalWeight === "number" ? emotionalWeight : 3,
      energyRequired: energyRequired || "medium",
      timeBlock: timeBlock || "30min",
      blocksSomeone: !!blocksSomeone,
      dopamineSource: dopamineSource || "routine",
      lastTouched: new Date().toISOString(),
      streakDays: 0,
      blockReason: finalBlockReason
    };

    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title,
        description: description || null,
        status,
        projectId: targetProjectId,
        creatorId: auth.userId,
        tdahMetrics
      }
    });

    return Response.json(task, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/v1/focus/tasks:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}
