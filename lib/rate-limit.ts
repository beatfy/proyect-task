import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export async function rateLimit(
  key: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<{ allowed: boolean; remaining: number }> {
  const cutoff = new Date(Date.now() - windowMs);

  await prisma.$executeRaw`
    DELETE FROM "RateLimit" WHERE "updatedAt" < ${cutoff} AND "key" = ${key}
  `;

  const row = (await prisma.rateLimit.findUnique({ where: { key } })) as {
    count: number;
    updatedAt: Date;
  } | null;

  if (row) {
    if (row.count >= maxAttempts) {
      return { allowed: false, remaining: 0 };
    }
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 }, updatedAt: new Date() },
    });
    return { allowed: true, remaining: maxAttempts - row.count - 1 };
  }

  await prisma.rateLimit.create({ data: { key } });
  return { allowed: true, remaining: maxAttempts - 1 };
}
