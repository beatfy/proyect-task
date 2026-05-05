import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { cuid } from "@/lib/utils";

// POST - Generar link de invitación
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { projectId, role, maxUses, expiresDays } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
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
        { error: "No tienes permisos para crear links de invitación" },
        { status: 403 }
      );
    }

    // Generar token único
    const token = randomBytes(32).toString("base64url");

    // Calcular fecha de expiración
    let expiresAt: Date | null = null;
    if (expiresDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresDays);
    }

    const inviteToken = await prisma.projectInviteToken.create({
      data: {
        id: cuid(),
        token,
        projectId,
        createdBy: authResult.userId,
        role: role || "MEMBER",
        maxUses: maxUses || null,
        expiresAt,
      },
    });

    // Construir URL de invitación
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/join/${token}`;

    return NextResponse.json({
      token: inviteToken.token,
      url: inviteUrl,
      expiresAt: inviteToken.expiresAt,
      maxUses: inviteToken.maxUses,
    });
  } catch (error) {
    console.error("Create invite link error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET - Listar links de invitación de un proyecto
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es miembro del proyecto
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: authResult.userId },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No tienes acceso a este proyecto" },
        { status: 403 }
      );
    }

    const tokens = await prisma.projectInviteToken.findMany({
      where: { projectId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const tokensWithUrl = tokens.map((t: { token: string; [key: string]: unknown }) => ({
      ...t,
      url: `${baseUrl}/join/${t.token}`,
    }));

    return NextResponse.json(tokensWithUrl);
  } catch (error) {
    console.error("Get invite links error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}