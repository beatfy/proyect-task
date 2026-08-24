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
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);

    const logs = await prisma.fastingLog.findMany({
      where: { userId },
      orderBy: { startTime: "desc" },
      take: limit,
    });

    const formattedLogs = logs.map((log) => {
      let durationHours = 0;
      if (log.endTime) {
        durationHours = (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / (1000 * 60 * 60);
      }
      return {
        ...log,
        durationHours: Number(durationHours.toFixed(2)),
      };
    });

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error("GET /api/v1/fasting/history error:", error);
    return NextResponse.json({ error: "Error al obtener historial de ayunos" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.fastingLog.deleteMany({
      where: { id, userId: authResult.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/v1/fasting/history error:", error);
    return NextResponse.json({ error: "Error al eliminar registro de ayuno" }, { status: 500 });
  }
}

