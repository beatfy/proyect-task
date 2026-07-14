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

    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { project: { include: { members: true } } } });
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    let isPrivileged = invoice.project.members.some((m: { userId: string; role: string }) => m.userId === authResult.userId && ["OWNER", "ADMIN"].includes(m.role));
    if (!isPrivileged && invoice.project.organizationId) {
      const orgMember = await prisma.organizationMember.findFirst({
        where: {
          userId: authResult.userId,
          organizationId: invoice.project.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });
      if (orgMember) isPrivileged = true;
    }

    if (!isPrivileged) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status === "PAID") updateData.paidAt = new Date();

    const updated = await prisma.invoice.update({ where: { id }, data: updateData });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update invoice error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { project: { include: { members: true } } } });
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    let isPrivileged = invoice.project.members.some((m: { userId: string; role: string }) => m.userId === authResult.userId && ["OWNER", "ADMIN"].includes(m.role));
    if (!isPrivileged && invoice.project.organizationId) {
      const orgMember = await prisma.organizationMember.findFirst({
        where: {
          userId: authResult.userId,
          organizationId: invoice.project.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });
      if (orgMember) isPrivileged = true;
    }

    if (!isPrivileged) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete invoice error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
