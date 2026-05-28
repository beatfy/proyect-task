import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function authenticateOrgApiKey(request: NextRequest): Promise<{ organizationId: string; orgName: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.replace("Bearer ", "").trim();
  if (!key) return null;

  const org = await prisma.organization.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true },
  });

  if (!org) return null;

  await prisma.organization.update({
    where: { id: org.id },
    data: { updatedAt: new Date() },
  }).catch(() => {});

  return { organizationId: org.id, orgName: org.name };
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
