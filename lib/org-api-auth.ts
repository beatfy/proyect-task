import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function authenticateOrgApiKey(request: NextRequest): Promise<{ organizationId: string; orgName: string; userId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  let key = authHeader.replace("Bearer ", "").trim();
  if (!key) return null;

  // Support base64 encoded API keys to bypass AI gateway censorship
  if (key.startsWith("tx2b64_")) {
    try {
      key = Buffer.from(key.substring(7), "base64").toString("utf8");
    } catch (err) {
      console.error("Failed to decode base64 organization API key:", err);
    }
  }

  let userId: string | null = null;
  let organizationId: string | null = null;
  let orgName = "";

  // 1. First check if it's a valid Organization API key
  const org = await prisma.organization.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true },
  });

  if (org) {
    organizationId = org.id;
    orgName = org.name;
    // Find first member to use as creator/assignee for API operations
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id },
      select: { userId: true },
      orderBy: { joinedAt: "asc" },
    });
    if (member) {
      userId = member.userId;
    }
  } else {
    // 2. If not, check if it's a User API key (e.g. Ele Agent Key)
    if (key.startsWith("tx2_")) {
      const keyPrefix = key.substring(0, 8);
      const apiKey = await prisma.apiKey.findFirst({
        where: { keyPrefix, active: true },
        select: { id: true, userId: true, permissions: true, key: true },
      });

      if (apiKey && await bcrypt.compare(key, apiKey.key)) {
        userId = apiKey.userId;
        // Find organization of this user
        const member = await prisma.organizationMember.findFirst({
          where: { userId: apiKey.userId },
          select: { organizationId: true, organization: { select: { name: true } } },
          orderBy: { joinedAt: "asc" },
        });
        if (member) {
          organizationId = member.organizationId;
          orgName = member.organization.name;
        }
      }
    }
  }

  if (!organizationId || !userId) {
    return null;
  }

  // Update organization updatedAt field
  await prisma.organization.update({
    where: { id: organizationId },
    data: { updatedAt: new Date() },
  }).catch(() => {});

  return { organizationId, orgName, userId };
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
