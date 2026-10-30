import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/tenant";
import { cuid } from "@/lib/utils";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const hasAccess = await canAccessProject(authResult.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    // Check if an existing client portal token already exists
    let inviteToken = await prisma.projectInviteToken.findFirst({
      where: {
        projectId,
        role: "CLIENT",
      },
    });

    if (!inviteToken) {
      const tokenStr = `cp_${crypto.randomBytes(16).toString("hex")}`;
      inviteToken = await prisma.projectInviteToken.create({
        data: {
          id: cuid(),
          token: tokenStr,
          projectId,
          createdBy: authResult.userId,
          role: "CLIENT",
          // Client tokens do not expire by default so client links stay valid
          expiresAt: null,
        },
      });
    }

    const origin = request.nextUrl.origin;
    const portalUrl = `${origin}/portal/${inviteToken.token}`;

    return NextResponse.json({
      token: inviteToken.token,
      portalUrl,
      message: "Enlace del portal de cliente generado",
    });
  } catch (error) {
    console.error("Portal link error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
