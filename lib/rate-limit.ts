import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;

export async function rateLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date(Date.now() - WINDOW_MS);

  // Clean old entries
  await prisma.$executeRaw`
    DELETE FROM "RateLimit" WHERE "updatedAt" < ${now} AND "key" = ${key}
  `;

  // Get current count
  const row = await prisma.rateLimit.findUnique({ where: { key } }) as { count: number; updatedAt: Date } | null;

  if (row) {
    if (row.count >= MAX_ATTEMPTS) {
      return { allowed: false, remaining: 0 };
    }
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 }, updatedAt: new Date() },
    });
    return { allowed: true, remaining: MAX_ATTEMPTS - row.count - 1 };
  }

  await prisma.rateLimit.create({ data: { key } });
  return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
}
