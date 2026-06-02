import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

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
      const keyPrefix = token.substring(0, 8);
      const apiKey = await prisma.apiKey.findFirst({
        where: { keyPrefix, active: true },
        select: { id: true, userId: true, permissions: true, key: true },
      });

      if (apiKey && await bcrypt.compare(token, apiKey.key)) {
        // Update lastUsedAt (non-blocking)
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {});

        return { userId: apiKey.userId, permissions: apiKey.permissions };
      }

      // Check if it's an Organization API key
      const org = await prisma.organization.findUnique({
        where: { apiKey: token },
        select: { id: true },
      });

      if (org) {
        const member = await prisma.organizationMember.findFirst({
          where: { organizationId: org.id },
          select: { userId: true },
          orderBy: { joinedAt: "asc" },
        });

        if (member) {
          return { userId: member.userId, permissions: "full" };
        }
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
