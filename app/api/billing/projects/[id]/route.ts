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

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (!member) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.monthlyFee !== undefined) updateData.monthlyFee = parseFloat(body.monthlyFee);

    const project = await prisma.project.update({ where: { id }, data: updateData });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Update billing error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
