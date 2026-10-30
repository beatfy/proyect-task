import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Automated archiving for completed tasks older than 7 days.
// Preserves TimeEntry, Comment, and Attachment history for billing and reports.
// Runs daily via Vercel Cron or manual invocation.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find all completed (non-archived) tasks older than 7 days
    const completedTasks = await prisma.task.findMany({
      where: {
        status: { not: "ARCHIVED" },
        OR: [
          { status: { in: ["DONE", "COMPLETED", "Hecho", "done", "completed"] } },
          { stage: { name: { in: ["Hecho", "Completado", "Done", "Finalizado"], mode: "insensitive" } } },
        ],
        updatedAt: { lt: sevenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    if (completedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        archivedCount: 0,
        deletedCount: 0,
        message: "No hay tareas completadas con más de 7 días para archivar.",
      });
    }

    const taskIds = completedTasks.map((t) => t.id);

    // Archive tasks in batch instead of destructive deleteMany (preserves TimeEntry & Report history)
    const result = await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: {
        status: "ARCHIVED",
      },
    });

    return NextResponse.json({
      success: true,
      archivedCount: result.count,
      deletedCount: result.count,
      archivedTasks: completedTasks.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt })),
      message: `Se archivaron ${result.count} tareas completadas con más de 7 días.`,
    });
  } catch (error) {
    console.error("Error in cleanup-tasks cron:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
