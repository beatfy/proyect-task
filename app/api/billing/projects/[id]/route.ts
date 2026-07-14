import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    let isPrivileged = false;
    if (project) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId: id, userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
      });
      if (member) {
        isPrivileged = true;
      } else if (project.organizationId) {
        const orgMember = await prisma.organizationMember.findFirst({
          where: {
            userId: authResult.userId,
            organizationId: project.organizationId,
            role: { in: ["OWNER", "ADMIN"] },
          },
        });
        if (orgMember) isPrivileged = true;
      }
    }

    if (!isPrivileged) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.monthlyFee !== undefined) updateData.monthlyFee = parseFloat(body.monthlyFee);

    const updated = await prisma.project.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update billing error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
