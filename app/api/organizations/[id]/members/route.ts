import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authResult.userId,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Get org members error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authResult.userId,
          organizationId: id,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ error: "No tienes permisos para invitar miembros" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    // Role escalation prevention: only OWNER can assign OWNER role
    if (role === "OWNER" && membership.role !== "OWNER") {
      return NextResponse.json({ error: "Solo un OWNER puede asignar el rol OWNER" }, { status: 403 });
    }
    // ADMIN can only assign MEMBER or ADMIN
    if (membership.role === "ADMIN" && !["MEMBER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Un ADMIN solo puede asignar roles MEMBER o ADMIN" }, { status: 403 });
    }

    // Get org info for email
    const org = await prisma.organization.findUnique({
      where: { id },
      select: { name: true },
    });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // User doesn't exist — create an invitation and send email
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          organizationId: id,
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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.invitation.create({
        data: {
          id: cuid(),
          email,
          organizationId: id,
          invitedBy: authResult.userId,
          role,
          expiresAt,
        },
      });

      // Build invite URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beatfy.app";
      const inviteUrl = `${appUrl}/join/${invitation.id}`;

      // Send invitation email via Resend
      const inviter = await prisma.user.findUnique({
        where: { id: authResult.userId },
        select: { name: true },
      });
      const RESEND_API_KEY = process.env.RESEND_API_KEY;

      if (RESEND_API_KEY) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Has sido invitado a ${org?.name || "Beatfy"}</h1>
            </div>
            <div style="padding: 32px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>${inviter?.name || "Un usuario"}</strong> te ha invitado a unirte a la organización <strong>${org?.name || ""}</strong> en Beatfy.
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

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Beatfy <noreply@beatfy.app>",
            to: [email],
            subject: `${inviter?.name || "Un usuario"} te ha invitado a ${org?.name || "Beatfy"}`,
            html,
          }),
        }).catch((e) => console.error("Resend error:", e));
      }

      return NextResponse.json({
        ...invitation,
        pendingInvite: true,
        inviteUrl,
        message: `Invitación creada.${RESEND_API_KEY ? " Se ha enviado un email al invitado." : " Comparte el enlace manualmente."}`,
      });
    }

    const existing = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "El usuario ya es miembro de la organización" }, { status: 400 });
    }

    const newMember = await prisma.organizationMember.create({
      data: {
        id: cuid(),
        userId: user.id,
        organizationId: id,
        role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Send notification
    if (user.id !== authResult.userId) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: user.id,
          type: "ORGANIZATION_INVITATION",
          title: `Añadido a la organización: ${org?.name}`,
          content: `Te han añadido a la organización "${org?.name}"`,
          data: { organizationId: id },
        },
      });
    }

    return NextResponse.json(newMember);
  } catch (error) {
    console.error("Add org member error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId requerido" }, { status: 400 });
    }

    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== id) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    // User can remove themselves (leave) or OWNER/ADMIN can remove others
    const callerMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: authResult.userId,
          organizationId: id,
        },
      },
    });

    if (!callerMembership) {
      return NextResponse.json({ error: "No tienes acceso" }, { status: 403 });
    }

    const isSelf = targetMember.userId === authResult.userId;

    if (!isSelf && !["OWNER", "ADMIN"].includes(callerMembership.role)) {
      return NextResponse.json({ error: "No tienes permisos para eliminar miembros" }, { status: 403 });
    }

    // Cannot remove last OWNER
    if (targetMember.role === "OWNER") {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: "OWNER" },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar al último propietario. Transfiere la propiedad primero." },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove org member error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
