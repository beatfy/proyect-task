import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function rateLimit(
  key: string
): Promise<{ allowed: boolean; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() - WINDOW_MS);

    await tx.$executeRaw`
      DELETE FROM "RateLimit" WHERE "updatedAt" < ${cutoff} AND "key" = ${key}
    `;

    const row = await tx.rateLimit.findUnique({ where: { key } });

    if (row) {
      if (row.count >= MAX_ATTEMPTS) {
        return { allowed: false, remaining: 0 };
      }
      await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 }, updatedAt: new Date() },
      });
      return { allowed: true, remaining: MAX_ATTEMPTS - row.count - 1 };
    }

    await tx.rateLimit.create({ data: { key } });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  });
}
