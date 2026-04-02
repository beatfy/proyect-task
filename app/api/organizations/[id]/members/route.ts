import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
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

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
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

    const org = await prisma.organization.findUnique({
      where: { id },
      select: { name: true },
    });

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
    if (user.id !== session.user.id) {
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
    const session = await auth();
    if (!session?.user?.id) {
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
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!callerMembership) {
      return NextResponse.json({ error: "No tienes acceso" }, { status: 403 });
    }

    const isSelf = targetMember.userId === session.user.id;

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
