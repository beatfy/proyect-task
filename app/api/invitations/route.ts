import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// GET - Listar mis invitaciones pendientes
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        email: session.user.email as string,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        project: {
          select: { id: true, name: true, description: true, color: true },
        },
        inviter: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Get invitations error:", error);
    // Devolver array vacío en caso de error para evitar crash en cliente
    return NextResponse.json([]);
  }
}

// POST - Crear invitación por email
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { email, projectId, role } = await request.json();

    if (!email || !projectId) {
      return NextResponse.json(
        { error: "Email y projectId requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es owner/admin del proyecto
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: authResult.userId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No tienes permisos para invitar a este proyecto" },
        { status: 403 }
      );
    }

    // Verificar si ya es miembro
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId, user: { email } },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Este usuario ya es miembro del proyecto" },
        { status: 400 }
      );
    }

    // Verificar si ya tiene invitación pendiente
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        projectId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Ya existe una invitación pendiente para este email" },
        { status: 400 }
      );
    }

    // Crear invitación (expira en 7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        id: cuid(),
        email,
        projectId,
        invitedBy: authResult.userId,
        role: role || "MEMBER",
        expiresAt,
      },
      include: {
        project: { select: { name: true } },
      },
    });

    // Crear notificación si el usuario ya existe
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (invitedUser) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: invitedUser.id,
          type: "PROJECT_INVITATION",
          title: `Invitación a ${invitation.project?.name || "una organización"}`,
          content: `Has sido invitado al proyecto "${invitation.project?.name || ""}"`,
          data: { invitationId: invitation.id, projectId: projectId || undefined },
        },
      });
    }

    return NextResponse.json(invitation);
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}