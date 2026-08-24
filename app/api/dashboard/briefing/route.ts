import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;

    // 1. Obtener estado de ayuno activo
    const [activeFast, config] = await Promise.all([
      prisma.fastingLog.findFirst({
        where: { userId, endTime: null },
        orderBy: { startTime: "desc" },
      }),
      prisma.fastingConfig.findUnique({
        where: { userId },
      }),
    ]);

    let fastingInfo = null;
    if (activeFast) {
      const now = new Date();
      const elapsedMs = Math.max(0, now.getTime() - new Date(activeFast.startTime).getTime());
      const elapsedHours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(1));
      const targetHours = activeFast.targetHours || 16;
      const progressPercent = Math.min(100, Math.round((elapsedHours / targetHours) * 100));

      let phase = "Digestión";
      let phaseIcon = "🥗";
      if (elapsedHours >= 16) {
        phase = "Autofagia y Renovación";
        phaseIcon = "🧬";
      } else if (elapsedHours >= 12) {
        phase = "Pico de Cetosis y Enfoque Mental";
        phaseIcon = "⚡";
      } else if (elapsedHours >= 8) {
        phase = "Quema de Grasa Activa";
        phaseIcon = "🔥";
      } else if (elapsedHours >= 4) {
        phase = "Estabilización de Insulina";
        phaseIcon = "📉";
      }

      fastingInfo = {
        active: true,
        protocol: activeFast.protocol,
        elapsedHours,
        targetHours,
        progressPercent,
        phase,
        phaseIcon,
        isFocusPeak: elapsedHours >= 12 && elapsedHours <= 18,
        waterDrankMl: config?.waterDrankMl || 0,
        waterGoalMl: config?.waterGoalMl || 2500,
      };
    } else {
      fastingInfo = {
        active: false,
        waterDrankMl: config?.waterDrankMl || 0,
        waterGoalMl: config?.waterGoalMl || 2500,
      };
    }

    // 2. Top 3 tareas prioritarias del día
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const topTasks = await prisma.task.findMany({
      where: {
        OR: [
          { assigneeId: userId },
          { creatorId: userId },
          { taskAssignees: { some: { userId } } },
        ],
        status: { notIn: ["DONE", "COMPLETED", "Hecho"] },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: 3,
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        status: true,
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // 3. Recomendación diaria de productividad & biohacking
    let recommendation = "";
    const hour = new Date().getHours();

    if (fastingInfo.active && fastingInfo.isFocusPeak) {
      recommendation = "⚡ Estás en tu pico metabólico de cetosis (12h-16h). Aprovecha las próximas horas para avanzar en tus tareas de máxima complejidad antes de romper el ayuno.";
    } else if (hour < 12) {
      recommendation = "🌅 Mañana enfocada: Dedica tu primer bloque del día a tu tarea más urgente. Mantén una buena hidratación con agua o infusiones.";
    } else if (hour < 18) {
      recommendation = "🎯 Tarde productiva: Revisa tus avances del día y define los próximos entregables clave.";
    } else {
      recommendation = "🌙 Cierre de jornada: Planifica el inicio de tu ayuno nocturno para favorecer el descanso y la regeneración celular.";
    }

    return NextResponse.json({
      success: true,
      fastingInfo,
      topTasks,
      recommendation,
    });
  } catch (error) {
    console.error("GET /api/dashboard/briefing error:", error);
    return NextResponse.json({ error: "Error al generar briefing" }, { status: 500 });
  }
}
