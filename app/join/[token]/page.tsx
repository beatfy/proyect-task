import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import JoinProjectClient from "./JoinProjectClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  // Buscar el token de invitación
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

  if (!inviteToken) {
    notFound();
  }

  // Verificar si ha expirado
  if (inviteToken.expiresAt && inviteToken.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Link Expirado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Este link de invitación ha caducado.
          </p>
        </div>
      </div>
    );
  }

  // Verificar si se ha alcanzado el máximo de usos
  if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Link Agotado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Este link de invitación ya no está disponible.
          </p>
        </div>
      </div>
    );
  }

  // Verificar si el usuario está autenticado
  const session = await auth();

  if (!session?.user) {
    // Guardar el token en una cookie o redirigir con el token en la URL
    redirect(`/login?redirect=/join/${token}`);
  }

  // Verificar si ya es miembro
  const existingMember = await prisma.projectMember.findFirst({
    where: {
      projectId: inviteToken.projectId,
      userId: session.user.id,
    },
  });

  if (existingMember) {
    redirect(`/projects/${inviteToken.projectId}`);
  }

  return (
    <JoinProjectClient
      project={inviteToken.project}
      inviter={inviteToken.creator}
      token={token}
    />
  );
}