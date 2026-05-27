import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// GET - Listar mis invitaciones pendientes
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { email: true },
    });

    const invitations = await prisma.invitation.findMany({
      where: {
        email: user?.email,
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

    // Enviar email de invitación via Resend
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://taskProject.app";
    const inviteUrl = `${appUrl}/join/${invitation.id}`;
    const inviter = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { name: true },
    });
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Has sido invitado a ${invitation.project?.name || "taskProject"}</h1>
          </div>
          <div style="padding: 32px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              <strong>${inviter?.name || "Un usuario"}</strong> te ha invitado a unirte al proyecto <strong>${invitation.project?.name || ""}</strong> en taskProject.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Aceptar invitación
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              O copia este enlace en tu navegador:<br/>
              <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Esta invitación expira en 7 días. Si no esperabas este email, ignóralo.
            </p>
          </div>
        </div>
      `;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "taskProject <noreply@taskProject.app>",
          to: [email],
          subject: `${inviter?.name || "Un usuario"} te ha invitado a ${invitation.project?.name || "taskProject"}`,
          html,
        }),
      });

      if (!resendRes.ok) {
        const err = await resendRes.text();
        console.error("Resend email error:", err);
        // No fallamos la creación, solo logueamos el error
      }
    }

    return NextResponse.json({
      ...invitation,
      inviteUrl,
      message: "Invitación creada. Se ha enviado un email al invitado.",
    });
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}