import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { selectDopaminePrimers } from "@/lib/focus";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    const userTasks = await prisma.task.findMany({
      where: {
        status: { notIn: ["DONE", "completed"] },
        project: { organizationId: auth.organizationId },
      },
    });

    const [randomPrimer] = selectDopaminePrimers(userTasks, 1);
    return Response.json(randomPrimer);
  } catch (error: unknown) {
    console.error("Error en GET /api/v1/focus/primer:", error);
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    return apiError(msg, 500);
  }
}
