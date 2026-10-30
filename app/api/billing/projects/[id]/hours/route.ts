import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const hasAccess = await canAccessProject(authResult.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        task: { projectId },
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        duration: { not: null },
      },
      select: {
        id: true,
        duration: true,
        startTime: true,
        description: true,
        task: {
          select: { id: true, title: true },
        },
      },
    });

    const totalSeconds = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

    // Group hours by task
    const taskBreakdownMap: Record<string, { taskId: string; title: string; seconds: number; hours: number }> = {};
    for (const entry of timeEntries) {
      const tId = entry.task.id;
      if (!taskBreakdownMap[tId]) {
        taskBreakdownMap[tId] = {
          taskId: tId,
          title: entry.task.title,
          seconds: 0,
          hours: 0,
        };
      }
      taskBreakdownMap[tId].seconds += entry.duration || 0;
    }

    for (const key of Object.keys(taskBreakdownMap)) {
      taskBreakdownMap[key].hours = Math.round((taskBreakdownMap[key].seconds / 3600) * 100) / 100;
    }

    return NextResponse.json({
      projectId,
      month,
      year,
      totalSeconds,
      totalHours,
      entriesCount: timeEntries.length,
      tasks: Object.values(taskBreakdownMap),
    });
  } catch (error) {
    console.error("Get project hours error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
