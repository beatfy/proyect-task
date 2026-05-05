import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const organizationId = searchParams.get("organizationId");

    if (!query || query.length < 2) {
      return NextResponse.json({ contacts: [], deals: [] });
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const orgFilter: Record<string, unknown> = {};
    if (organizationId && organizationId !== "all") {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      orgFilter.organizationId = organizationId;
    } else {
      orgFilter.OR = [
        { organizationId: { in: userOrgIds } },
        { ownerId: authResult.userId, organizationId: null },
      ];
    }

    const q = query.toLowerCase();

    const [contacts, deals] = await Promise.all([
      prisma.contact.findMany({
        where: {
          ...orgFilter,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          status: true,
          _count: { select: { deals: true, activities: true } },
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.deal.findMany({
        where: {
          ...orgFilter,
          title: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          title: true,
          value: true,
          probability: true,
          contact: { select: { name: true } },
          stage: { select: { name: true, color: true } },
        },
        take: 10,
        orderBy: { movedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ contacts, deals });
  } catch (error) {
    console.error("CRM global search error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
