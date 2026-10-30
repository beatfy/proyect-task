import { cuid } from "./utils";

export interface TaskChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export async function recordTaskAudit(
  prisma: any,
  options: {
    taskId: string;
    userId?: string | null;
    action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
    changes?: TaskChange[];
    metadata?: Record<string, any>;
  }
) {
  const { taskId, userId, action, changes, metadata } = options;

  if (!prisma?.taskAuditLog) return;

  if (changes && changes.length > 0) {
    const entries = changes.map((c) => ({
      id: cuid(),
      taskId,
      userId: userId || null,
      action,
      field: c.field,
      oldValue: c.oldValue !== undefined && c.oldValue !== null ? String(c.oldValue) : null,
      newValue: c.newValue !== undefined && c.newValue !== null ? String(c.newValue) : null,
      metadata: metadata || null,
    }));

    await prisma.taskAuditLog.createMany({
      data: entries,
    });
  } else {
    await prisma.taskAuditLog.create({
      data: {
        id: cuid(),
        taskId,
        userId: userId || null,
        action,
        metadata: metadata || null,
      },
    });
  }
}

export async function getTaskAuditHistory(prisma: any, taskId: string, limit = 50) {
  if (!prisma?.taskAuditLog) return [];
  return await prisma.taskAuditLog.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
}

export async function revertTaskAuditLog(
  prisma: any,
  options: {
    auditLogId: string;
    userId?: string | null;
  }
): Promise<{ success: boolean; taskId: string; field: string; restoredValue: any }> {
  const { auditLogId, userId } = options;

  const log = await prisma.taskAuditLog.findUnique({
    where: { id: auditLogId },
  });

  if (!log || !log.field) {
    throw new Error("Entrada de auditoría no encontrada o no revertible");
  }

  const taskId = log.taskId;
  const field = log.field;
  const restoredValue = log.oldValue;

  const currentTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!currentTask) {
    throw new Error("La tarea ya no existe");
  }

  const currentValue = (currentTask as any)[field];

  // Perform update
  const updateData: Record<string, any> = {};
  if (field === "dueDate") {
    updateData[field] = restoredValue ? new Date(restoredValue) : null;
  } else {
    updateData[field] = restoredValue;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  // Record restoration in audit log
  await recordTaskAudit(prisma, {
    taskId,
    userId,
    action: "RESTORE",
    changes: [
      {
        field,
        oldValue: currentValue,
        newValue: restoredValue,
      },
    ],
    metadata: {
      revertedLogId: auditLogId,
    },
  });

  return {
    success: true,
    taskId,
    field,
    restoredValue,
  };
}
