import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canModifyTask } from "@/lib/authz";
import { cuid } from "@/lib/utils";

export async function PATCH(
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
    const { emotionalWeight, status, timeSpent } = body; // status: "aliviada" | "sigue_pesando" | "hecha"

    const authorized = await canModifyTask(authResult.userId, id);
    if (!authorized) {
      return NextResponse.json({ error: "No tienes permisos para modificar esta tarea" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    let currentMetrics: Record<string, any> = {};
    if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
      currentMetrics = { ...(task.tdahMetrics as Record<string, any>) };
    }

    // Determine new status and emotional weight
    let newStatus = task.status;
    let newWeight = typeof emotionalWeight === "number" ? emotionalWeight : (currentMetrics.emotionalWeight || 1);

    if (status === "hecha") {
      newStatus = "DONE";
    } else if (status === "aliviada") {
      // Alleviated: reduce base emotional weight, keep task active
      newWeight = Math.max(1, newWeight - 2);
    } else if (status === "sigue_pesando") {
      // Still heavy: weight remains or increases slightly
      newWeight = Math.min(5, newWeight + 0.5);
    }

    // Update metrics
    const updatedMetrics = {
      ...currentMetrics,
      emotionalWeight: newWeight,
      lastTouched: new Date().toISOString(),
      streakDays: 0, // Reset streak since it was touched
    };

    // Update Task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: newStatus,
        tdahMetrics: updatedMetrics,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
      }
    });

    // Log time entries if timeSpent is provided
    if (timeSpent && timeSpent > 0) {
      const durationSeconds = Math.round(timeSpent * 60);
      const startTime = new Date(Date.now() - durationSeconds * 1000);
      await prisma.timeEntry.create({
        data: {
          id: cuid(),
          taskId: id,
          userId: authResult.userId,
          startTime,
          endTime: new Date(),
          duration: durationSeconds,
          description: "Sesión Focus Flow (TDAH)",
        }
      });
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Update TDAH progress error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
