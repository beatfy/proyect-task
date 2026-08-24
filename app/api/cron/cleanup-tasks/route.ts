import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Automated cleanup for completed tasks older than 7 days.
// Runs daily via Vercel Cron or manual invocation.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find all completed tasks older than 7 days (based on updatedAt when they were moved to done)
    const completedTasks = await prisma.task.findMany({
      where: {
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
        deletedCount: 0,
        message: "No hay tareas completadas con más de 7 días para eliminar.",
      });
    }

    const taskIds = completedTasks.map((t) => t.id);

    // Delete tasks in batch (cascade will clean up subtasks, assignees, comments, attachments)
    const result = await prisma.task.deleteMany({
      where: {
        id: { in: taskIds },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      deletedTasks: completedTasks.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt })),
      message: `Se eliminaron ${result.count} tareas completadas con más de 7 días.`,
    });
  } catch (error) {
    console.error("Error in cleanup-tasks cron:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
