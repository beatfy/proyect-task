import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";
import { buildFocusQueue } from "@/lib/focus";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const energyFilter = searchParams.get("energy"); // low|medium|high

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
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
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    const focusQueue = buildFocusQueue(tasks, { energyFilter, limit: 5 });
    return NextResponse.json(focusQueue);
  } catch (error) {
    console.error("Get TDAH queue error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
