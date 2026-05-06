import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { cuid } from "@/lib/utils";

// GET members of a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      },
      orderBy: { role: "asc" }
    });

    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "Error al obtener miembros" }, { status: 500 });
  }
}

// POST add member to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // User doesn't exist yet — create an invite link and return it
      const crypto = await import("crypto");
      const token = crypto.randomBytes(24).toString("hex");
      const expiresDays = 7;
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

      await prisma.projectInviteToken.create({
        data: {
          id: cuid(),
          token,
          projectId: id,
          createdBy: authResult.userId,
          role,
          expiresAt,
          maxUses: 1,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://beatfy.app`;
      const inviteUrl = `${appUrl}/join/${token}`;

      return NextResponse.json({
        invite: true,
        message: `El usuario no tiene cuenta. Comparte este enlace de invitación:`,
        inviteUrl,
        token,
      }, { status: 200 });
    }

    // Check if already member
    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: id } }
    });

    if (existing) {
      return NextResponse.json({ error: "Ya es miembro del proyecto" }, { status: 400 });
    }

    // Obtener info del proyecto y del invitador para el email
    const project = await prisma.project.findUnique({
      where: { id },
      select: { name: true },
    });
    const inviter = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { name: true },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beatfy.app";
    const inviteUrl = `${appUrl}/join/${id}`;


    // Add member
    const member = await prisma.projectMember.create({
      data: {
        id: cuid(),
        userId: user.id,
        projectId: id,
        role
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    // Crear notificación
    await prisma.notification.create({
      data: {
        id: cuid(),
        userId: user.id,
        type: "PROJECT_INVITATION",
        title: `Invitación a ${project?.name || "un proyecto"}`,
        content: `Has sido añadido/a al proyecto "${project?.name || ""}"`,
        data: { projectId: id },
      },
    });

    // Enviar email de invitación via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Has sido añadido a ${project?.name || "Beatfy"}</h1>
          </div>
          <div style="padding: 32px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              <strong>${inviter?.name || "Un usuario"}</strong> te ha añadido al proyecto <strong>${project?.name || ""}</strong> en Beatfy.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Ir al proyecto
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              O copia este enlace en tu navegador:<br/>
              <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Si no esperabas este email, contacta con el administrador.
            </p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Beatfy <noreply@beatfy.app>",
          to: [user.email],
          subject: `Has sido añadido a ${project?.name || "Beatfy"}`,
          html,
        }),
      });
    }

    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Error al añadir miembro" }, { status: 500 });
  }
}

// DELETE remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId requerido" }, { status: 400 });
    }

    await prisma.projectMember.delete({
      where: { id: memberId }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar miembro" }, { status: 500 });
  }
}