import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Check membership
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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
        members: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      ...organization,
      role: organization.members[0]?.role || "MEMBER",
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: "No tienes permisos para editar esta organización" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Update organization error:", error);
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

    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ error: "Solo el propietario puede eliminar la organización" }, { status: 403 });
    }

    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete organization error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
