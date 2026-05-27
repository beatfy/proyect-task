import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    // 1) Try ProjectInviteToken (existing project flow)
    const inviteToken = await prisma.projectInviteToken.findUnique({
      where: { token },
      include: { project: true },
    });

    if (inviteToken) {
      // --- PROJECT TOKEN flow (existing) ---
      if (inviteToken.expiresAt && inviteToken.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Este link ha expirado" },
          { status: 400 }
        );
      }

      if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
        return NextResponse.json(
          { error: "Este link ya no está disponible" },
          { status: 400 }
        );
      }

      const existingMember = await prisma.projectMember.findFirst({
        where: {
          projectId: inviteToken.projectId,
          userId: authResult.userId,
        },
      });

      if (existingMember) {
        return NextResponse.json(
          {
            error: "Ya eres miembro de este proyecto",
            projectId: inviteToken.projectId,
            redirectTo: `/projects/${inviteToken.projectId}`,
          },
          { status: 400 }
        );
      }

      // Auto-add to organization if project belongs to one
      const project = inviteToken.project;
      const orgMemberCreate = project.organizationId
        ? [
            prisma.organizationMember.upsert({
              where: {
                userId_organizationId: {
                  userId: authResult.userId,
                  organizationId: project.organizationId,
                },
              },
              create: {
                id: cuid(),
                organizationId: project.organizationId,
                userId: authResult.userId,
                role: "MEMBER",
              },
              update: {},
            }),
          ]
        : [];

      await prisma.$transaction([
        prisma.projectMember.create({
          data: {
            id: cuid(),
            userId: authResult.userId,
            projectId: inviteToken.projectId,
            role: inviteToken.role,
          },
        }),
        ...orgMemberCreate,
        prisma.projectInviteToken.update({
          where: { id: inviteToken.id },
          data: { uses: { increment: 1 } },
        }),
      ]);

      // Notify creator
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: inviteToken.createdBy,
          type: "PROJECT_JOINED",
          title: `Un usuario se unió`,
          content: `Se unió a "${inviteToken.project.name}" via link de invitación`,
          data: { projectId: inviteToken.projectId },
        },
      });

      return NextResponse.json({
        success: true,
        projectId: inviteToken.projectId,
        redirectTo: `/projects/${inviteToken.projectId}`,
        message: `Te has unido a ${inviteToken.project.name}`,
      });
    }

    // 2) Fallback: try Invitation model (supports org invites)
    const invitation = await prisma.invitation.findUnique({
      where: { id: token },
      include: { project: true, organization: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 404 }
      );
    }

    // Expired?
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Esta invitación ha expirado" },
        { status: 400 }
      );
    }

    // Already processed?
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Esta invitación ya fue procesada" },
        { status: 400 }
      );
    }

    // ---- ORGANIZATION invitation ----
    if (invitation.organizationId && !invitation.projectId) {
      const existingOrgMember = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: authResult.userId,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (existingOrgMember) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });
        return NextResponse.json(
          {
            error: "Ya eres miembro de esta organización",
            redirectTo: `/organizations/${invitation.organizationId}`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        prisma.organizationMember.create({
          data: {
            id: cuid(),
            userId: authResult.userId,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        }),
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        }),
      ]);

      const orgName = invitation.organization?.name || "la organización";

      // Notify inviter
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: invitation.invitedBy,
          type: "PROJECT_JOINED",
          title: "Un usuario se unió",
          content: `Aceptó la invitación a "${orgName}"`,
          data: { organizationId: invitation.organizationId },
        },
      });

      return NextResponse.json({
        success: true,
        organizationId: invitation.organizationId,
        redirectTo: `/organizations/${invitation.organizationId}`,
        message: `Te has unido a ${orgName}`,
      });
    }

    // ---- PROJECT invitation ----
    if (invitation.projectId) {
      const existingMember = await prisma.projectMember.findFirst({
        where: {
          projectId: invitation.projectId,
          userId: authResult.userId,
        },
      });

      if (existingMember) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });
        return NextResponse.json(
          {
            error: "Ya eres miembro de este proyecto",
            projectId: invitation.projectId,
            redirectTo: `/projects/${invitation.projectId}`,
          },
          { status: 400 }
        );
      }

      // Auto-add to org if project belongs to one
      const orgMemberCreate =
        invitation.project?.organizationId
          ? [
              prisma.organizationMember.upsert({
                where: {
                  userId_organizationId: {
                    userId: authResult.userId,
                    organizationId: invitation.project.organizationId,
                  },
                },
                create: {
                  id: cuid(),
                  organizationId: invitation.project.organizationId,
                  userId: authResult.userId,
                  role: "MEMBER",
                },
                update: {},
              }),
            ]
          : [];

      await prisma.$transaction([
        prisma.projectMember.create({
          data: {
            id: cuid(),
            userId: authResult.userId,
            projectId: invitation.projectId,
            role: invitation.role,
          },
        }),
        ...orgMemberCreate,
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        }),
      ]);

      const projName = invitation.project?.name || "el proyecto";

      await prisma.notification.create({
        data: {
          id: cuid(),
          userId: invitation.invitedBy,
          type: "PROJECT_JOINED",
          title: "Un usuario se unió",
          content: `Aceptó la invitación a "${projName}"`,
          data: { projectId: invitation.projectId },
        },
      });

      return NextResponse.json({
        success: true,
        projectId: invitation.projectId,
        redirectTo: `/projects/${invitation.projectId}`,
        message: `Te has unido a ${projName}`,
      });
    }

    return NextResponse.json(
      { error: "Invitación sin destino" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Join error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
