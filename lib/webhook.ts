import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function notifyTaskWebhook(task: {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  creatorId?: string;
  taskAssignees?: Array<{ id?: string; email?: string; userId?: string }> | null;
}): Promise<void> {
  const recipientIds = new Set<string>();

  if (task.assigneeId) recipientIds.add(task.assigneeId);
  if (task.taskAssignees) {
    for (const ta of task.taskAssignees) {
      if (ta.userId) recipientIds.add(ta.userId);
    }
  }

  if (task.creatorId) recipientIds.delete(task.creatorId);

  if (recipientIds.size === 0) return;

  const priorityLabels: Record<string, string> = {
    URGENT: "🚨 Urgente",
    HIGH: "🔴 Alta",
    MEDIUM: "🟡 Media",
    LOW: "🟢 Baja",
  };

  const priorityText = task.priority ? priorityLabels[task.priority] || "" : "";
  const dueText = task.dueDate
    ? ` | Vence: ${task.dueDate.split("T")[0]}`
    : "";

  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      prisma.notification.create({
        data: {
          id: cuid(),
          userId,
          type: "TASK_ASSIGNED",
          title: `Tarea asignada: ${task.title}`,
          content: `Te han asignado la tarea "${task.title}"${priorityText ? ` (${priorityText})` : ""}${dueText}`,
          data: { taskId: task.id },
        },
      })
    )
  );
}
