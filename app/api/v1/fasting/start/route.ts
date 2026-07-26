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

    // Si hay un ayuno activo, cancelarlo o cerrarlo antes de iniciar otro
    const existingActive = await prisma.fastingLog.findFirst({
      where: { userId, completed: false },
    });

    if (existingActive) {
      await prisma.fastingLog.update({
        where: { id: existingActive.id },
        data: {
          endTime: new Date(),
          completed: false,
          notes: "Cancelado / Interrumpido al iniciar uno nuevo",
        },
      });
    }

    let config = await prisma.fastingConfig.findUnique({ where: { userId } });
    if (!config) {
      config = await prisma.fastingConfig.create({
        data: { userId, protocol: "16:8", targetFastHours: 16, targetEatingHours: 8 },
      });
    }

    const protocol = body.protocol || config.protocol || "16:8";
    const targetHours = body.targetHours || config.targetFastHours || 16;
    const startTime = body.startTime ? new Date(body.startTime) : new Date();

    const newFast = await prisma.fastingLog.create({
      data: {
        userId,
        protocol,
        targetHours,
        startTime,
        completed: false,
      },
    });

    // Guardar notificación de inicio de ayuno
    if (config.notifyFastStart) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId,
          type: "FASTING_START",
          title: "🚀 ¡Ayuno Intermitente Iniciado!",
          content: `Has comenzado tu ayuno ${protocol} (${targetHours} horas). Tu meta finaliza a las ${new Date(startTime.getTime() + targetHours * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          data: { fastId: newFast.id, protocol, targetHours },
        },
      }).catch((e) => console.error("Error creating notification:", e));
    }

    return NextResponse.json({ success: true, fast: newFast });
  } catch (error) {
    console.error("POST /api/v1/fasting/start error:", error);
    return NextResponse.json({ error: "Error al iniciar el ayuno" }, { status: 500 });
  }
}
