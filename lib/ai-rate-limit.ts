import { rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 1000;
const MAX_MESSAGES = 20;
const MAX_AGENT_CALLS = 10;

export async function aiRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return rateLimit(`ai-chat:${userId}`, MAX_MESSAGES, WINDOW_MS);
}

export async function agentRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return rateLimit(`ai-agent:${userId}`, MAX_AGENT_CALLS, WINDOW_MS);
}
