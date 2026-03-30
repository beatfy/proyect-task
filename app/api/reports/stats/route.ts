import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

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
    const userTasksWhere = {
      OR: [{ creatorId: userId }, { assigneeId: userId }],
    };

    // Tasks completed this week
    const completedThisWeek = await prisma.task.count({
      where: {
        ...userTasksWhere,
        status: "DONE",
        updatedAt: { gte: startOfWeek },
      },
    });

    // Tasks completed this month
    const completedThisMonth = await prisma.task.count({
      where: {
        ...userTasksWhere,
        status: "DONE",
        updatedAt: { gte: startOfMonth },
      },
    });

    // Tasks completed last month (for comparison)
    const completedLastMonth = await prisma.task.count({
      where: {
        ...userTasksWhere,
        status: "DONE",
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    });

    // Total time tracked this week
    const timeEntriesThisWeek = await prisma.timeEntry.aggregate({
      where: {
        userId,
        startTime: { gte: startOfWeek },
        duration: { not: null },
      },
      _sum: { duration: true },
    });

    // Total time tracked this month
    const timeEntriesThisMonth = await prisma.timeEntry.aggregate({
      where: {
        userId,
        startTime: { gte: startOfMonth },
        duration: { not: null },
      },
      _sum: { duration: true },
    });

    // Tasks by status
    const tasksByStatus = await prisma.task.groupBy({
      by: ["status"],
      where: userTasksWhere,
      _count: { status: true },
    });

    const statusMap: Record<string, number> = {};
    tasksByStatus.forEach((item) => {
      statusMap[item.status] = item._count.status;
    });

    // Active projects
    const activeProjects = await prisma.project.count({
      where: {
        status: "ACTIVE",
        members: { some: { userId } },
      },
    });

    // Total tasks
    const totalTasks = await prisma.task.count({
      where: userTasksWhere,
    });

    // Tasks by priority
    const tasksByPriority = await prisma.task.groupBy({
      by: ["priority"],
      where: userTasksWhere,
      _count: { priority: true },
    });

    const priorityMap: Record<string, number> = {};
    tasksByPriority.forEach((item) => {
      priorityMap[item.priority] = item._count.priority;
    });

    // Overdue tasks
    const overdueTasks = await prisma.task.count({
      where: {
        ...userTasksWhere,
        dueDate: { lt: now },
        status: { not: "DONE" },
      },
    });

    return NextResponse.json({
      completedThisWeek,
      completedThisMonth,
      completedLastMonth,
      totalTimeThisWeek: timeEntriesThisWeek._sum.duration || 0,
      totalTimeThisMonth: timeEntriesThisMonth._sum.duration || 0,
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
