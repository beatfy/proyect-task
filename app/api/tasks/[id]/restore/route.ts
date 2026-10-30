import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canModifyTask } from "@/lib/authz";
import { revertTaskAuditLog } from "@/lib/task-audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/[id]/restore
 * Reverts a specific change via auditLogId or un-archives the task.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID de tarea requerido" }, { status: 400 });
    }

    const canModify = await canModifyTask(authResult.userId, id);
    if (!canModify) {
      return NextResponse.json({ error: "Sin permisos para restaurar esta tarea" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { auditLogId } = body;

    if (auditLogId) {
      // Revert specific field change
      const result = await revertTaskAuditLog(prisma, {
        auditLogId,
        userId: authResult.userId,
      });

      return NextResponse.json({
        success: true,
        message: `Campo ${result.field} restaurado con éxito`,
        result,
      });
    }

    // Default: Un-archive task if it was ARCHIVED
    const task = await prisma.task.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const restoredStatus = task.status === "ARCHIVED" ? "DONE" : task.status;
    const updated = await prisma.task.update({
      where: { id },
      data: { status: restoredStatus },
    });

    return NextResponse.json({
      success: true,
      message: "Tarea restaurada con éxito",
      task: updated,
    });
  } catch (error: any) {
    console.error("POST /api/tasks/[id]/restore error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al restaurar la tarea" },
      { status: 500 }
    );
  }
}
