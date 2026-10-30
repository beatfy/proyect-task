import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";
import { selectDopaminePrimers } from "@/lib/focus";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const userTasks = await prisma.task.findMany({
      where: {
        status: {
          notIn: ["DONE", "completed"],
        },
        OR: [
          { creatorId: authResult.userId },
          { assigneeId: authResult.userId },
          { taskAssignees: { some: { userId: authResult.userId } } },
          { project: { organizationId: { in: userOrgIds } } },
        ],
      },
    });

    const selected = selectDopaminePrimers(userTasks, 3);
    return NextResponse.json(selected);
  } catch (error) {
    console.error("Get dopamine primers error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
