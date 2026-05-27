import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// CRON_SECRET env var to prevent external abuse
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // ── 1) Tasks due TODAY (not DONE) ──
    const dueToday = await prisma.task.findMany({
      where: {
        dueDate: { gte: todayStart, lt: todayEnd },
        status: { not: "DONE" },
      },
      include: {
        creator: { select: { id: true } },
        assignee: { select: { id: true } },
      },
    });

    let dueTodayCount = 0;

    for (const task of dueToday) {
      const userIds = [
        task.creatorId,
        task.assigneeId,
      ].filter((id): id is string => !!id);

      for (const userId of userIds) {
        // Check if we already sent a TASK_DUE_TODAY notification today
        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId,
            type: "TASK_DUE_TODAY",
            data: { path: ["taskId"], equals: task.id },
            createdAt: { gte: todayStart },
          },
        });

        if (!alreadyNotified) {
          await prisma.notification.create({
            data: {
              id: cuid(),
              userId,
              type: "TASK_DUE_TODAY",
              title: `📅 Tarea vence hoy: ${task.title}`,
              content: `"${task.title}" vence hoy. ¡No se te olvide!`,
              data: { taskId: task.id, projectId: task.projectId },
            },
          });
          dueTodayCount++;
        }
      }
    }

    // ── 2) Tasks OVERDUE (before today, not DONE) ──
    const overdue = await prisma.task.findMany({
      where: {
        dueDate: { lt: todayStart },
        status: { not: "DONE" },
      },
      include: {
        creator: { select: { id: true } },
        assignee: { select: { id: true } },
      },
    });

    let overdueCount = 0;

    for (const task of overdue) {
      const userIds = [
        task.creatorId,
        task.assigneeId,
      ].filter((id): id is string => !!id);

      for (const userId of userIds) {
        // Check if we already sent a TASK_OVERDUE notification today
        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId,
            type: "TASK_OVERDUE",
            data: { path: ["taskId"], equals: task.id },
            createdAt: { gte: todayStart },
          },
        });

        if (!alreadyNotified) {
          await prisma.notification.create({
            data: {
              id: cuid(),
              userId,
              type: "TASK_OVERDUE",
              title: `🚨 Tarea vencida: ${task.title}`,
              content: `"${task.title}" venció el ${new Date(task.dueDate!).toLocaleDateString("es-ES")}. ¡Necesita atención!`,
              data: { taskId: task.id, projectId: task.projectId },
            },
          });
          overdueCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      dueToday: dueTodayCount,
      overdue: overdueCount,
    });
  } catch (error) {
    console.error("[cron/due-date-reminders] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
