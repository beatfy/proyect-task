import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 1000;
const MAX_MESSAGES = 20;
const MAX_AGENT_CALLS = 10;

export async function aiRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ai-chat:${userId}`;
  const now = new Date(Date.now() - WINDOW_MS);

  await prisma.$executeRaw`
    DELETE FROM "RateLimit" WHERE "updatedAt" < ${now} AND "key" = ${key}
  `;

  const row = await prisma.rateLimit.findUnique({ where: { key } }) as { count: number; updatedAt: Date } | null;

  if (row) {
    if (row.count >= MAX_MESSAGES) {
      return { allowed: false, remaining: 0 };
    }
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 }, updatedAt: new Date() },
    });
    return { allowed: true, remaining: MAX_MESSAGES - row.count - 1 };
  }

  await prisma.rateLimit.create({ data: { key } });
  return { allowed: true, remaining: MAX_MESSAGES - 1 };
}

export async function agentRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ai-agent:${userId}`;
  const now = new Date(Date.now() - WINDOW_MS);

  await prisma.$executeRaw`
    DELETE FROM "RateLimit" WHERE "updatedAt" < ${now} AND "key" = ${key}
  `;

  const row = await prisma.rateLimit.findUnique({ where: { key } }) as { count: number; updatedAt: Date } | null;

  if (row) {
    if (row.count >= MAX_AGENT_CALLS) {
      return { allowed: false, remaining: 0 };
    }
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 }, updatedAt: new Date() },
    });
    return { allowed: true, remaining: MAX_AGENT_CALLS - row.count - 1 };
  }

  await prisma.rateLimit.create({ data: { key } });
  return { allowed: true, remaining: MAX_AGENT_CALLS - 1 };
}
