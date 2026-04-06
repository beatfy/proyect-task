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

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://xtask.space`;
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