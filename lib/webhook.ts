/**
 * Send a notification when a task is assigned to Scytale.
 * Uses both OpenClaw system events and Telegram Bot API.
 * Reads WEBHOOK_TELEGRAM_BOT_TOKEN and WEBHOOK_TELEGRAM_CHAT_ID from env vars.
 */
const SCYTALE_USER_ID = "scytale-admin-beatfy";
const SCYTALE_EMAIL = "scytale@beatfy.app";
const OPENCLAW_WEBHOOK_URL = process.env.OPENCLAW_WEBHOOK_URL || "https://clawd.beatfy.net/hooks/wake";
const OPENCLAW_AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "Bearer bc570c4242e94e3079f7c9855c7ab0ff547ad95b3d95ad03";
const TELEGRAM_BOT_TOKEN = process.env.WEBHOOK_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.WEBHOOK_TELEGRAM_CHAT_ID;

function isScytale(
  assigneeId?: string | null,
  assigneeEmail?: string | null,
  taskAssignees?: Array<{ id?: string; email?: string; userId?: string }> | null
): boolean {
  if (assigneeId === SCYTALE_USER_ID) return true;
  if (assigneeEmail === SCYTALE_EMAIL) return true;
  if (taskAssignees && Array.isArray(taskAssignees)) {
    for (const a of taskAssignees) {
      if (a.userId === SCYTALE_USER_ID || a.id === SCYTALE_USER_ID) return true;
      if (a.email === SCYTALE_EMAIL) return true;
    }
  }
  return false;
}

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
  if (!isScytale(task.assigneeId, task.assigneeEmail, task.taskAssignees)) return;

  const priorityLabel = task.priority || "NONE";

  // OpenClaw system event
  try {
    await fetch(OPENCLAW_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": OPENCLAW_AUTH_TOKEN },
      body: JSON.stringify({
        text: `Nueva tarea asignada a Scytale: ${task.title} (${priorityLabel})`,
        mode: "now",
      }),
    });
  } catch (error) {
    console.error("OpenClaw webhook notification failed:", error);
  }

  // Telegram fallback
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const priorityEmoji: Record<string, string> = {
      URGENT: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢", NONE: "⚪"
    };
    const emoji = priorityEmoji[priorityLabel] || "⚪";
    const due = task.dueDate ? `\n📅 Vence: ${new Date(task.dueDate).toLocaleDateString("es-ES")}` : "";

    const text = `📋 *Nueva tarea asignada*\n${emoji} *${task.title}*\n${task.description || ""}${due}`;

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
    console.error("Telegram webhook notification failed:", error);
  }
}
