import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Dual auth: API key (Bearer token) OR NextAuth session.
 * Returns { userId, permissions } or null.
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  userId: string;
  permissions: string;
} | null> {
  // 1. Check API key header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Only match our prefixed keys
    if (token.startsWith("tx2_")) {
      const apiKey = await prisma.apiKey.findFirst({
        where: { key: token, active: true },
        select: { id: true, userId: true, permissions: true },
      });

      if (apiKey) {
        // Update lastUsedAt (non-blocking)
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {});

        return { userId: apiKey.userId, permissions: apiKey.permissions };
      }
    }
  }

  // 2. Fallback to NextAuth session
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, permissions: "full" };
  }

  return null;
}
