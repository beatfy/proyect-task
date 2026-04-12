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
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
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

      // Send invitation email
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://task-x-2.vercel.app"}/api/invitations/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitationId: invitation.id,
            orgName: org?.name,
            inviterName: "Scytale",
          }),
        });
      } catch (e) {
        console.error("Failed to send invite email:", e);
      }

      return NextResponse.json({
        ...invitation,
        pendingInvite: true,
        message: `Invitación enviada a ${email}`,
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
