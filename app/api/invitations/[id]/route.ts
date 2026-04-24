import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// POST - Aceptar invitación
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json();

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      include: { project: true, organization: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id }, data: { status: "EXPIRED" } });
      return NextResponse.json({ error: "La invitación ha expirado" }, { status: 400 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "La invitación ya fue procesada" }, { status: 400 });
    }

    if (action === "accept") {
      if (invitation.projectId) {
        await prisma.projectMember.create({
          data: { id: cuid(), userId: authResult.userId, projectId: invitation.projectId, role: invitation.role },
        });
      } else if (invitation.organizationId) {
        await prisma.organizationMember.create({
          data: { id: cuid(), userId: authResult.userId, organizationId: invitation.organizationId, role: invitation.role },
        });
      }

      await prisma.invitation.update({ where: { id }, data: { status: "ACCEPTED" } });

      const targetName = invitation.project?.name || invitation.organization?.name || "Leadfy";
      await prisma.notification.create({
        data: {
          id: cuid(), userId: invitation.invitedBy, type: "PROJECT_JOINED",
          title: "Un usuario se unió", content: `Aceptó la invitación a "${targetName}"`,
          data: { projectId: invitation.projectId || undefined, organizationId: invitation.organizationId || undefined },
        },
      });

      return NextResponse.json({ success: true, message: `Te has unido a ${targetName}`, projectId: invitation.projectId || undefined, organizationId: invitation.organizationId || undefined });
    } else if (action === "reject") {
      await prisma.invitation.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json({ success: true, message: "Invitación rechazada" });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    console.error("Handle invitation error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE - Cancelar invitación (solo el que invitó)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    if (invitation.invitedBy !== authResult.userId) {
      return NextResponse.json({ error: "Solo el creador puede cancelar la invitación" }, { status: 403 });
    }

    await prisma.invitation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invitation error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
