import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    // Buscar el token
    const inviteToken = await prisma.projectInviteToken.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 404 }
      );
    }

    // Verificar si ha expirado
    if (inviteToken.expiresAt && inviteToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Este link ha expirado" },
        { status: 400 }
      );
    }

    // Verificar máximo de usos
    if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
      return NextResponse.json(
        { error: "Este link ya no está disponible" },
        { status: 400 }
      );
    }

    // Verificar si ya es miembro
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId: inviteToken.projectId,
        userId: session.user.id,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Ya eres miembro de este proyecto", projectId: inviteToken.projectId },
        { status: 400 }
      );
    }

    // Crear membresía y actualizar contador de usos
    await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          id: cuid(),
          userId: session.user.id,
          projectId: inviteToken.projectId,
          role: inviteToken.role,
        },
      }),
      prisma.projectInviteToken.update({
        where: { id: inviteToken.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    // Notificar al creador
    await prisma.notification.create({
      data: {
        id: cuid(),
        userId: inviteToken.createdBy,
        type: "PROJECT_JOINED",
        title: `${session.user.name || session.user.email} se unió`,
        content: `Se unió a "${inviteToken.project.name}" via link de invitación`,
        data: { projectId: inviteToken.projectId },
      },
    });

    return NextResponse.json({
      success: true,
      projectId: inviteToken.projectId,
      message: `Te has unido a ${inviteToken.project.name}`,
    });
  } catch (error) {
    console.error("Join project error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}