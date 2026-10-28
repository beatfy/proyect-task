import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { executePlanToPipeline, PlanData } from "@/lib/plan-executor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { planData, projectId } = body as { planData: PlanData; projectId?: string };

    if (!planData || !planData.phases) {
      return NextResponse.json({ error: "Datos del plan no válidos" }, { status: 400 });
    }

    const result = await executePlanToPipeline({
      planData,
      userId: authResult.userId,
      projectId: projectId || null,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Execute plan error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al ejecutar y cargar el plan en el proyecto" },
      { status: 500 }
    );
  }
}
