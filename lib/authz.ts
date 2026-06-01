import { prisma } from "@/lib/prisma";

/**
 * Check if a user can access/modify a task.
 * User must be the creator, the assignee, or a member of the task's project.
 */
export async function canAccessTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { creatorId: true, assigneeId: true, projectId: true },
  });

  if (!task) return false;

  // Creator or assignee can always access
  if (task.creatorId === userId || task.assigneeId === userId) return true;

  // Project members can access tasks in their projects
  if (task.projectId) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: task.projectId, userId },
      select: { id: true },
    });
    return !!membership;
  }

  return false;
}

/**
 * Check if a user can modify/delete a task.
 * User must be the creator, or an OWNER/ADMIN of the task's project.
 */
export async function canModifyTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      creatorId: true,
      assigneeId: true,
      projectId: true,
      organizationId: true,
      project: { select: { organizationId: true } },
      taskAssignees: { select: { userId: true } },
    },
  });

  if (!task) return false;

  // 1. Creator can always modify
  if (task.creatorId === userId) return true;

  // 2. Assignee (direct or multi-assignee) can modify
  if (task.assigneeId === userId) return true;
  if (task.taskAssignees.some(ta => ta.userId === userId)) return true;

  // 3. Project members can modify
  if (task.projectId) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: task.projectId, userId },
      select: { id: true },
    });
    if (membership) return true;

    // Organization OWNER/ADMIN of the project's organization can modify
    if (task.project?.organizationId) {
      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: task.project.organizationId },
        },
        select: { role: true },
      });
      if (orgMember && ["OWNER", "ADMIN"].includes(orgMember.role)) return true;
    }
  }

  // 4. Organization OWNER/ADMIN of the task's direct organization can modify
  if (task.organizationId) {
    const orgMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: task.organizationId },
      },
      select: { role: true },
    });
    if (orgMember && ["OWNER", "ADMIN"].includes(orgMember.role)) return true;
  }

  return false;
}

/**
 * Check if a user is OWNER or ADMIN of a project.
 */
export async function isProjectAdmin(userId: string, projectId: string): Promise<boolean> {
  const membership = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Check if a user is a member of a project (any role).
 */
export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  });
  return !!membership;
}
