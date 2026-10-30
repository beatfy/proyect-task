import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessTask } from "@/lib/authz";
import { getTaskAuditHistory } from "@/lib/task-audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[id]/history
 * Returns the audit trail and change history for a task.
 */
export async function GET(
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

    const hasAccess = await canAccessTask(authResult.userId, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sin acceso a esta tarea" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const history = await getTaskAuditHistory(prisma, id, limit);

    return NextResponse.json({
      taskId: id,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("GET /api/tasks/[id]/history error:", error);
    return NextResponse.json({ error: "Error interno al obtener el historial" }, { status: 500 });
  }
}
