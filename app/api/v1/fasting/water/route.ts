import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;
    const body = await req.json().catch(() => ({}));
    const amountMl = parseInt(body.amountMl || "250");

    let config = await prisma.fastingConfig.findUnique({ where: { userId } });
    if (!config) {
      config = await prisma.fastingConfig.create({
        data: { userId, protocol: "16:8", waterGoalMl: 2500, waterDrankMl: 0 },
      });
    }

    const newAmount = Math.max(0, (config.waterDrankMl || 0) + amountMl);

    const updatedConfig = await prisma.fastingConfig.update({
      where: { userId },
      data: {
        waterDrankMl: newAmount,
      },
    });

    return NextResponse.json({ success: true, waterDrankMl: updatedConfig.waterDrankMl, waterGoalMl: updatedConfig.waterGoalMl });
  } catch (error) {
    console.error("POST /api/v1/fasting/water error:", error);
    return NextResponse.json({ error: "Error al registrar agua" }, { status: 500 });
  }
}
