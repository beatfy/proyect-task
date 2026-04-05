/**
 * Send a notification when a task is assigned to Scytale.
 * Uses Telegram Bot API to notify OpenClaw directly.
 * Reads WEBHOOK_TELEGRAM_BOT_TOKEN and WEBHOOK_TELEGRAM_CHAT_ID from env vars.
 */
const SCYTALE_USER_ID = "scytale-admin-beatfy";
const TELEGRAM_BOT_TOKEN = process.env.WEBHOOK_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.WEBHOOK_TELEGRAM_CHAT_ID;

export async function notifyTaskWebhook(task: {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  creatorId?: string;
}): Promise<void> {
  // Only notify if assigned to Scytale
  if (task.assigneeId !== SCYTALE_USER_ID) return;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const priorityEmoji: Record<string, string> = {
      URGENT: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢", NONE: "⚪"
    };
    const emoji = priorityEmoji[task.priority || "NONE"] || "⚪";
    const due = task.dueDate ? `📅 Vence: ${new Date(task.dueDate).toLocaleDateString("es-ES")}` : "";

    const text = `📋 *Nueva tarea asignada*\n${emoji} *${task.title}*\n${task.description || ""}\n${due}`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("Webhook notification failed:", error);
  }
}
