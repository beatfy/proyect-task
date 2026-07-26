import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { cuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;
    const body = await req.json().catch(() => ({}));
    const { feeling, notes } = body;

    const activeFast = await prisma.fastingLog.findFirst({
      where: { userId, completed: false },
      orderBy: { startTime: "desc" },
    });

    if (!activeFast) {
      return NextResponse.json({ error: "No hay ningún ayuno activo para finalizar" }, { status: 404 });
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(activeFast.startTime).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const targetHours = activeFast.targetHours || 16;
    const completedGoal = elapsedHours >= targetHours * 0.9; // Considerado completado si alcanza el 90% o más del objetivo

    const updatedFast = await prisma.fastingLog.update({
      where: { id: activeFast.id },
      data: {
        endTime: now,
        completed: completedGoal,
        feeling: feeling || "good",
        notes: notes || null,
      },
    });

    const config = await prisma.fastingConfig.findUnique({ where: { userId } });
    if (config?.notifyFastEnd) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId,
          type: "FASTING_END",
          title: completedGoal ? "🎉 ¡Ayuno Completado con Éxito!" : "🏁 Ayuno Finalizado",
          content: `Has ayunado ${elapsedHours.toFixed(1)} horas. ¡Buen trabajo! Recuerda romper tu ayuno con proteína magra y vegetales.`,
          data: { fastId: activeFast.id, elapsedHours, completedGoal },
        },
      }).catch((e) => console.error("Error creating notification:", e));
    }

    return NextResponse.json({ success: true, fast: updatedFast, elapsedHours, completedGoal });
  } catch (error) {
    console.error("POST /api/v1/fasting/end error:", error);
    return NextResponse.json({ error: "Error al finalizar el ayuno" }, { status: 500 });
  }
}
