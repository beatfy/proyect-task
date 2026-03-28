import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// POST - Aceptar invitación
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json();

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitación no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el email coincide
    if (invitation.email !== session.user.email) {
      return NextResponse.json(
        { error: "Esta invitación no es para ti" },
        { status: 403 }
      );
    }

    // Verificar que no ha expirado
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "La invitación ha expirado" },
        { status: 400 }
      );
    }

    // Verificar que está pendiente
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "La invitación ya fue procesada" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      // Crear membresía
      await prisma.projectMember.create({
        data: {
          id: cuid(),
          userId: session.user.id,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      });

      // Actualizar invitación
      await prisma.invitation.update({
        where: { id },
        data: { status: "ACCEPTED" },
      });

      // Notificar al invitador
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: invitation.invitedBy,
          type: "PROJECT_JOINED",
          title: `${session.user.name || session.user.email} se unió`,
          content: `Aceptó la invitación a "${invitation.project.name}"`,
          data: { projectId: invitation.projectId },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Te has unido a ${invitation.project.name}`,
        projectId: invitation.projectId,
      });
    } else if (action === "reject") {
      await prisma.invitation.update({
        where: { id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json({
        success: true,
        message: "Invitación rechazada",
      });
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitación no encontrada" },
        { status: 404 }
      );
    }

    if (invitation.invitedBy !== session.user.id) {
      return NextResponse.json(
        { error: "Solo el creador puede cancelar la invitación" },
        { status: 403 }
      );
    }

    await prisma.invitation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invitation error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}