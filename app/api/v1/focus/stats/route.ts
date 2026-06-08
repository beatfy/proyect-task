import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

    // Fetch all pending (not done/completed) tasks
    const pendingTasks = await prisma.task.findMany({
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
    let totalAttentionDebt = 0;
    let streakAlerts = 0;
    const projectLoads: Record<string, { name: string; color: string; load: number }> = {};

    pendingTasks.forEach((task) => {
      let metrics: Record<string, any> = {};
      if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
        metrics = { ...(task.tdahMetrics as Record<string, any>) };
      }

      const baseWeight = typeof metrics.emotionalWeight === "number" ? metrics.emotionalWeight : 1;
      const lastTouchedStr = metrics.lastTouched || task.updatedAt.toISOString();
      const lastTouchedDate = new Date(lastTouchedStr);
      const diffTime = Math.abs(now.getTime() - lastTouchedDate.getTime());
      const streakDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Auto-escalation: +0.5 per day untouched (max 5)
      const emotionalWeight = Math.min(5, baseWeight + 0.5 * streakDays);

      totalAttentionDebt += emotionalWeight;

      if (streakDays > 3) {
        streakAlerts += 1;
      }

      if (task.projectId && task.project) {
        if (!projectLoads[task.projectId]) {
          projectLoads[task.projectId] = {
            name: task.project.name,
            color: task.project.color,
            load: 0
          };
        }
        projectLoads[task.projectId].load += emotionalWeight;
      }
    });

    // Find highest load project
    let highestLoadProject = null;
    let maxLoad = -1;
    for (const pid in projectLoads) {
      if (projectLoads[pid].load > maxLoad) {
        maxLoad = projectLoads[pid].load;
        highestLoadProject = {
          id: pid,
          name: projectLoads[pid].name,
          color: projectLoads[pid].color,
          load: parseFloat(projectLoads[pid].load.toFixed(1))
        };
      }
    }

    // Weekly trend
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let currentWeekLoad = 0;
    let prevWeekLoad = 0;

    pendingTasks.forEach((task) => {
      let metrics: Record<string, any> = {};
      if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
        metrics = { ...(task.tdahMetrics as Record<string, any>) };
      }
      const baseWeight = typeof metrics.emotionalWeight === "number" ? metrics.emotionalWeight : 1;
      const lastTouchedStr = metrics.lastTouched || task.updatedAt.toISOString();
      const lastTouchedDate = new Date(lastTouchedStr);
      const diffTime = Math.abs(now.getTime() - lastTouchedDate.getTime());
      const streakDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const emotionalWeight = Math.min(5, baseWeight + 0.5 * streakDays);

      const createdDate = new Date(task.createdAt);
      if (createdDate >= sevenDaysAgo) {
        currentWeekLoad += emotionalWeight;
      } else if (createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo) {
        prevWeekLoad += emotionalWeight;
      }
    });

    let trendPercentage = 0;
    if (prevWeekLoad > 0) {
      trendPercentage = ((currentWeekLoad - prevWeekLoad) / prevWeekLoad) * 100;
    } else if (currentWeekLoad > 0) {
      trendPercentage = 100;
    }

    return Response.json({
      totalAttentionDebt: parseFloat(totalAttentionDebt.toFixed(1)),
      streakAlerts,
      highestLoadProject,
      weeklyTrend: {
        currentWeekLoad: parseFloat(currentWeekLoad.toFixed(1)),
        prevWeekLoad: parseFloat(prevWeekLoad.toFixed(1)),
        percentage: parseFloat(trendPercentage.toFixed(1)),
        direction: trendPercentage >= 0 ? "up" : "down"
      }
    });
  } catch (error: any) {
    console.error("Error en GET /api/v1/focus/stats:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}
