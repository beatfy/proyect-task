import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const energyFilter = searchParams.get("energy"); // low|medium|high

    const userOrgIds = await getUserOrgIds(authResult.userId);

    // Fetch all pending tasks for this user
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        status: {
          notIn: ["DONE", "completed"]
        },
        OR: [
          { creatorId: authResult.userId },
          { assigneeId: authResult.userId },
          { taskAssignees: { some: { userId: authResult.userId } } },
          { project: { organizationId: { in: userOrgIds } } },
        ],
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        },
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
      
      const lastTouchedDate = new Date(lastTouchedStr);
      const diffTime = Math.abs(now.getTime() - lastTouchedDate.getTime());
      const streakDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Auto-escalation rule: +0.5 weight per day untouched (max 5)
      const emotionalWeight = Math.min(5, baseWeight + 0.5 * streakDays);

      // Promotion rule: streak > 3 days and blocks someone
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
          isPromoted
        }
      };
    });

    // Filter by cognitive energy if requested
    let filtered = processedTasks;
    if (energyFilter) {
      filtered = processedTasks.filter(
        (t) => t.tdahMetrics.energyRequired === energyFilter
      );
    }

    // Sort by:
    // 1. Promoted tasks first (streak > 3 & blocksSomeone)
    // 2. emotionalWeight DESC
    // 3. streakDays DESC
    // 4. createdAt DESC
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

    // Focus window: Max 5 tasks
    const focusQueue = filtered.slice(0, 5);

    return NextResponse.json(focusQueue);
  } catch (error) {
    console.error("Get TDAH queue error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
