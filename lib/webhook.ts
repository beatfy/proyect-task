/**
 * Send a notification when a task is assigned to Scytale.
 * Uses both OpenClaw system events and Telegram Bot API.
 * Reads WEBHOOK_TELEGRAM_BOT_TOKEN and WEBHOOK_TELEGRAM_CHAT_ID from env vars.
 */
const SCYTALE_USER_ID = "scytale-admin-beatfy";
const SCYTALE_EMAIL = "scytale@beatfy.app";
const OPENCLAW_WEBHOOK_URL = process.env.OPENCLAW_WEBHOOK_URL || "http://localhost:18789/api/webhook/openclaw";
const TELEGRAM_BOT_TOKEN = process.env.WEBHOOK_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.WEBHOOK_TELEGRAM_CHAT_ID;

function isScytale(assigneeId?: string | null, assigneeEmail?: string | null): boolean {
  if (assigneeId === SCYTALE_USER_ID) return true;
  if (assigneeEmail === SCYTALE_EMAIL) return true;
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
}): Promise<void> {
  if (!isScytale(task.assigneeId, task.assigneeEmail)) return;

  const priorityLabel = task.priority || "NONE";

  // OpenClaw system event
  try {
    await fetch(OPENCLAW_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Nueva tarea asignada a Scytale: ${task.title} (${priorityLabel})`,
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
