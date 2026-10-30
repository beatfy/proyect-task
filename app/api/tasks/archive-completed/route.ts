import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canModifyProject, getUserOrgIds } from "@/lib/tenant";

/**
 * Manual archiving of completed tasks older than N days (default 7).
 * Preserves TimeEntry, Comment, and Report history.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = body.projectId;
    const daysOld = typeof body.daysOld === "number" && body.daysOld >= 0 ? body.daysOld : 7;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const completionCondition = [
      { status: { in: ["DONE", "COMPLETED", "Hecho", "done", "completed"] } },
      { stage: { name: { in: ["Hecho", "Completado", "Done", "Finalizado"], mode: "insensitive" } } },
    ];

    const where: Record<string, unknown> = {
      status: { not: "ARCHIVED" },
      OR: completionCondition,
      updatedAt: { lt: cutoffDate },
    };

    if (projectId && projectId !== "all") {
      const canMod = await canModifyProject(authResult.userId, projectId);
      if (!canMod) {
        return NextResponse.json({ error: "Sin permisos en este proyecto" }, { status: 403 });
      }
      where.projectId = projectId;
    } else {
      const userOrgIds = await getUserOrgIds(authResult.userId);
      where.AND = [
        {
          OR: [
            { creatorId: authResult.userId },
            { project: { members: { some: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } } } } },
            { project: { organizationId: { in: userOrgIds } } },
          ],
        },
      ];
    }

    const tasksToArchive = await prisma.task.findMany({
      where,
      select: { id: true, title: true, updatedAt: true },
    });

    if (tasksToArchive.length === 0) {
      return NextResponse.json({
        archivedCount: 0,
        message: `No hay tareas completadas con más de ${daysOld} días para archivar.`,
      });
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: tasksToArchive.map((t) => t.id) } },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({
      archivedCount: result.count,
      message: `Se archivaron manualmente ${result.count} tarea(s) completada(s).`,
    });
  } catch (error) {
    console.error("Manual archive error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
