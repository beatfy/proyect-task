import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 1000;
const MAX_MESSAGES = 20;
const MAX_AGENT_CALLS = 10;

async function rateLimitWithTx(
  key: string,
  maxLimit: number
): Promise<{ allowed: boolean; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() - WINDOW_MS);

    await tx.$executeRaw`
      DELETE FROM "RateLimit" WHERE "updatedAt" < ${cutoff} AND "key" = ${key}
    `;

    const row = await tx.rateLimit.findUnique({ where: { key } });

    if (row) {
      if (row.count >= maxLimit) {
        return { allowed: false, remaining: 0 };
      }
      await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 }, updatedAt: new Date() },
      });
      return { allowed: true, remaining: maxLimit - row.count - 1 };
    }

    await tx.rateLimit.create({ data: { key } });
    return { allowed: true, remaining: maxLimit - 1 };
  });
}

export async function aiRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return rateLimitWithTx(`ai-chat:${userId}`, MAX_MESSAGES);
}

export async function agentRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return rateLimitWithTx(`ai-agent:${userId}`, MAX_AGENT_CALLS);
}
