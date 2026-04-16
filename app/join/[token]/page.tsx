import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import JoinProjectClient from "./JoinProjectClient";

interface Props {
  params: Promise<{ token: string }>;
}

// ---------- Error / expired pages ----------
function ExpiredView({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Link Expirado</h1>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function ExhaustedView({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Link Agotado</h1>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  // 1) Try ProjectInviteToken first (existing project flow)
  const inviteToken = await prisma.projectInviteToken.findUnique({
    where: { token },
    include: {
      project: {
        select: { id: true, name: true, description: true, color: true },
      },
      creator: {
        select: { id: true, name: true },
      },
    },
  });

  if (inviteToken) {
    // --- PROJECT TOKEN flow (existing) ---
    if (inviteToken.expiresAt && inviteToken.expiresAt < new Date()) {
      return <ExpiredView message="Este link de invitación ha caducado." />;
    }
    if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
      return <ExhaustedView message="Este link de invitación ya no está disponible." />;
    }

    const session = await auth();
    if (!session?.user) {
      redirect(`/register?redirect=${encodeURIComponent(`/join/${token}`)}`);
    }

    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId: inviteToken.projectId, userId: session.user.id },
    });
    if (existingMember) {
      redirect(`/projects/${inviteToken.projectId}`);
    }

    return (
      <JoinProjectClient
        type="project"
        target={{
          id: inviteToken.project.id,
          name: inviteToken.project.name,
          description: inviteToken.project.description,
          color: inviteToken.project.color,
        }}
        inviter={inviteToken.creator}
        token={token}
      />
    );
  }

  // 2) Fallback: try Invitation model (supports org invites)
  const invitation = await prisma.invitation.findUnique({
    where: { id: token },
    include: {
      project: { select: { id: true, name: true, description: true, color: true } },
      organization: { select: { id: true, name: true, description: true, logo: true } },
      inviter: { select: { id: true, name: true } },
    },
  });

  if (!invitation) {
    notFound();
  }

  // Expired?
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return <ExpiredView message="Esta invitación ha caducado." />;
  }

  // Already processed?
  if (invitation.status !== "PENDING") {
    const dest = invitation.organizationId
      ? `/organizations/${invitation.organizationId}`
      : invitation.projectId
        ? `/projects/${invitation.projectId}`
        : "/dashboard";
    redirect(dest);
  }

  // Auth check
  const session = await auth();
  if (!session?.user) {
    redirect(`/register?redirect=${encodeURIComponent(`/join/${token}`)}`);
  }

  // ---- ORGANIZATION invitation ----
  if (invitation.organizationId && !invitation.projectId) {
    const existingOrgMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id!,
          organizationId: invitation.organizationId,
        },
      },
    });
    if (existingOrgMember) {
      redirect(`/organizations/${invitation.organizationId}`);
    }

    return (
      <JoinProjectClient
        type="organization"
        target={{
          id: invitation.organization!.id,
          name: invitation.organization!.name,
          description: invitation.organization!.description,
          color: undefined,
          logo: invitation.organization!.logo,
        }}
        inviter={invitation.inviter}
        token={token}
      />
    );
  }

  // ---- PROJECT invitation ----
  if (invitation.projectId) {
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId: invitation.projectId, userId: session.user.id! },
    });
    if (existingMember) {
      redirect(`/projects/${invitation.projectId}`);
    }

    return (
      <JoinProjectClient
        type="project"
        target={{
          id: invitation.project!.id,
          name: invitation.project!.name,
          description: invitation.project!.description,
          color: invitation.project!.color,
        }}
        inviter={invitation.inviter}
        token={token}
      />
    );
  }

  notFound();
}