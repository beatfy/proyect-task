import { prisma } from "@/lib/prisma";

export async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return memberships.map((m: { organizationId: string }) => m.organizationId);
}

export async function verifyOrgMembership(
  userId: string,
  organizationId: string
): Promise<{ valid: boolean; role: string }> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: { role: true },
  });
  if (!membership) return { valid: false, role: "" };
  return { valid: true, role: membership.role };
}

export async function requireOrgAccess(
  userId: string,
  organizationId: string
): Promise<string> {
  const { valid } = await verifyOrgMembership(userId, organizationId);
  if (!valid) {
    throw new Error("NO_ORG_ACCESS");
  }
  return organizationId;
}

export async function isOrgAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { valid, role } = await verifyOrgMembership(userId, organizationId);
  return valid && ["OWNER", "ADMIN"].includes(role);
}

export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, members: { where: { userId } } },
  });
  if (!project) return false;
  if (project.members.length > 0) return true;
  if (project.organizationId) {
    const { valid } = await verifyOrgMembership(userId, project.organizationId);
    return valid;
  }
  return false;
}

export async function canModifyProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      organizationId: true,
      members: { where: { userId, role: { in: ["OWNER", "ADMIN"] } } },
    },
  });
  if (!project) return false;
  if (project.members.length > 0) return true;
  if (project.organizationId) {
    return isOrgAdmin(userId, project.organizationId);
  }
  return false;
}
