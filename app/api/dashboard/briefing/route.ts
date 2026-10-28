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

    // 1. Top 3 tareas prioritarias del día
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

    // 2. Recomendación diaria de productividad
    let recommendation = "";
    const hour = new Date().getHours();

    if (hour < 12) {
      recommendation = "🌅 Mañana enfocada: Dedica tu primer bloque del día a tu tarea más prioritaria.";
    } else if (hour < 18) {
      recommendation = "🎯 Tarde productiva: Revisa tus avances del día y define los próximos entregables clave.";
    } else {
      recommendation = "🌙 Cierre de jornada: Repasa lo completado hoy y deja preparadas tus prioridades para mañana.";
    }

    return NextResponse.json({
      success: true,
      topTasks,
      recommendation,
    });
  } catch (error) {
    console.error("GET /api/dashboard/briefing error:", error);
    return NextResponse.json({ error: "Error al generar briefing" }, { status: 500 });
  }
}
