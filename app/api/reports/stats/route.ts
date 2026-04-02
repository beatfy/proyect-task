import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Safe helper — returns fallback instead of throwing
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Start of this week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Start of last month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // End of last month
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Tasks where user is creator or assignee
    const userTasksWhere: Record<string, unknown> = {
      OR: [{ creatorId: userId }, { assigneeId: userId }],
    };

    // Filter by organization if provided
    if (organizationId) {
      userTasksWhere.project = { organizationId };
    }

    // Run all queries with individual fallbacks
    const completedThisWeek = await safeQuery(
      () => prisma.task.count({
        where: { ...userTasksWhere, status: "DONE", updatedAt: { gte: startOfWeek } },
      }),
      0
    );

    const completedThisMonth = await safeQuery(
      () => prisma.task.count({
        where: { ...userTasksWhere, status: "DONE", updatedAt: { gte: startOfMonth } },
      }),
      0
    );

    const completedLastMonth = await safeQuery(
      () => prisma.task.count({
        where: { ...userTasksWhere, status: "DONE", updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      0
    );

    const timeEntriesThisWeek = await safeQuery(
      () => prisma.timeEntry.aggregate({
        where: { userId, startTime: { gte: startOfWeek }, duration: { not: null } },
        _sum: { duration: true },
      }),
      { _sum: { duration: 0 } }
    );

    const timeEntriesThisMonth = await safeQuery(
      () => prisma.timeEntry.aggregate({
        where: { userId, startTime: { gte: startOfMonth }, duration: { not: null } },
        _sum: { duration: true },
      }),
      { _sum: { duration: 0 } }
    );

    const tasksByStatusRaw = await safeQuery(
      () => prisma.task.groupBy({ by: ["status"], where: userTasksWhere, _count: { status: true } }),
      [] as { status: string; _count: { status: number } }[]
    );

    const statusMap: Record<string, number> = {};
    tasksByStatusRaw.forEach((item) => {
      statusMap[item.status] = item._count.status;
    });

    const activeProjectsWhere: Record<string, unknown> = {
      status: "ACTIVE",
      members: { some: { userId } },
    };
    if (organizationId) {
      activeProjectsWhere.organizationId = organizationId;
    }

    const activeProjects = await safeQuery(
      () => prisma.project.count({
        where: activeProjectsWhere,
      }),
      0
    );

    const totalTasks = await safeQuery(
      () => prisma.task.count({ where: userTasksWhere }),
      0
    );

    const tasksByPriorityRaw = await safeQuery(
      () => prisma.task.groupBy({ by: ["priority"], where: userTasksWhere, _count: { priority: true } }),
      [] as { priority: string; _count: { priority: number } }[]
    );

    const priorityMap: Record<string, number> = {};
    tasksByPriorityRaw.forEach((item) => {
      priorityMap[item.priority] = item._count.priority;
    });

    const overdueTasks = await safeQuery(
      () => prisma.task.count({
        where: { ...userTasksWhere, dueDate: { lt: now }, status: { not: "DONE" } },
      }),
      0
    );

    return NextResponse.json({
      completedThisWeek,
      completedThisMonth,
      completedLastMonth,
      totalTimeThisWeek: timeEntriesThisWeek._sum?.duration || 0,
      totalTimeThisMonth: timeEntriesThisMonth._sum?.duration || 0,
      tasksByStatus: statusMap,
      tasksByPriority: priorityMap,
      activeProjects,
      totalTasks,
      overdueTasks,
    });
  } catch (error) {
    console.error("Reports stats error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
