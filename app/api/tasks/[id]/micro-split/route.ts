import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canModifyTask } from "@/lib/authz";
import { cuid } from "@/lib/utils";

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
    const body = await request.json();
    const { steps } = body; // Array of titles: string[]

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Se requieren pasos/subtareas" }, { status: 400 });
    }

    const authorized = await canModifyTask(authResult.userId, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta tarea" }, { status: 403 });
    }

    const parentTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!parentTask) {
      return NextResponse.json({ error: "Tarea padre no encontrada" }, { status: 404 });
    }

    let parentMetrics: Record<string, any> = {};
    if (parentTask.tdahMetrics && typeof parentTask.tdahMetrics === "object") {
      parentMetrics = { ...(parentTask.tdahMetrics as Record<string, any>) };
    }

    const emotionalWeight = parentMetrics.emotionalWeight || 1;
    const energyRequired = parentMetrics.energyRequired || "medium";
    const dopamineSource = parentMetrics.dopamineSource || "routine";

    const createdSubtasks = [];
    for (const stepTitle of steps) {
      if (!stepTitle || typeof stepTitle !== "string") continue;
      
      const subtaskId = cuid();
      const subtask = await prisma.task.create({
        data: {
          id: subtaskId,
          title: stepTitle,
          status: "TODO",
          priority: parentTask.priority || "NONE",
          projectId: parentTask.projectId,
          creatorId: authResult.userId,
          parentId: id,
          organizationId: parentTask.organizationId,
          pipelineId: parentTask.pipelineId,
          stageId: parentTask.stageId, // Keep on the same pipeline stage as parent, or default
          tdahMetrics: {
            emotionalWeight: Math.max(1, emotionalWeight - 1), // slightly less heavy
            energyRequired,
            timeBlock: "15min", // default short time block for micro-splitting
            dopamineSource,
            lastTouched: new Date().toISOString(),
            streakDays: 0,
          }
        }
      });
      createdSubtasks.push(subtask);
    }

    return NextResponse.json({ subtasks: createdSubtasks });
  } catch (error) {
    console.error("Micro-split error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
