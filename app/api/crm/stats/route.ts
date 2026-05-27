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
    const organizationId = searchParams.get("organizationId");

    const userOrgIds = await getUserOrgIds(authResult.userId);

    let orgFilter: Record<string, unknown>;
    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      orgFilter = { organizationId };
    } else {
      orgFilter = {
        OR: [
          { organizationId: { in: userOrgIds } },
          { ownerId: authResult.userId, organizationId: null },
        ],
      };
    }

    const orgIdFilter: Record<string, unknown> = organizationId
      ? { organizationId }
      : { organizationId: { in: userOrgIds } };

    const contactsByStatus = await prisma.contact.groupBy({
      by: ["status"],
      where: orgIdFilter,
      _count: true,
    });

    const totalContacts = contactsByStatus.reduce((sum: number, c: { _count: number }) => sum + c._count, 0);

    // Get leads count
    const leadsCount = contactsByStatus.find((c: { status: string }) => c.status === "LEAD")?._count || 0;

    // Get open deals (not in "Cerrado Ganado" or "Cerrado Perdido" stages)
    const closedStages = await prisma.pipelineStage.findMany({
      where: {
        name: { in: ["Cerrado Ganado", "Cerrado Perdido"] },
      },
      select: { id: true },
    });

    const closedStageIds = closedStages.map((s: { id: string }) => s.id);

    const openDeals = await prisma.deal.findMany({
      where: {
        ...orgFilter,
        stageId: { notIn: closedStageIds },
      },
      include: {
        stage: { select: { name: true, position: true } },
      },
    });

    const openDealsCount = openDeals.length;

    // Total pipeline value
    const pipelineValue = openDeals.reduce((sum: number, d: { value: number }) => sum + d.value, 0);

    // Weighted pipeline value
    const weightedValue = openDeals.reduce((sum: number, d: { value: number; probability: number }) => sum + (d.value * d.probability / 100), 0);

    // Deals by stage
    const dealsByStage = await prisma.deal.groupBy({
      by: ["stageId"],
      where: orgIdFilter,
      _count: true,
      _sum: { value: true },
    });

    const stages = await prisma.pipelineStage.findMany({
      where: organizationId ? { pipeline: { organizationId } } : { pipeline: { organizationId: { in: userOrgIds } } },
      orderBy: { position: "asc" },
      include: {
        deals: {
          where: orgFilter,
        },
      },
    });

    const pipelineStages = stages.map((stage: { id: string; name: string; color: string; position: number; deals: { value: number }[] }) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      dealCount: stage.deals.length,
      totalValue: stage.deals.reduce((sum: number, d: { value: number }) => sum + d.value, 0),
    }));

    // Recent contacts
    const recentContacts = await prisma.contact.findMany({
      where: orgFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, company: true, status: true, createdAt: true },
    });

    // Recent deals
    const recentDeals = await prisma.deal.findMany({
      where: orgFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { name: true } },
        stage: { select: { name: true, color: true } },
      },
    });

    // Recent activities (10 for dashboard)
    const recentActivities = await prisma.activity.findMany({
      where: orgFilter,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { name: true } },
      },
    });

    // Top deals by value
    const topDeals = await prisma.deal.findMany({
      where: {
        stageId: { notIn: closedStageIds },
        ...orgFilter,
      },
      include: {
        contact: { select: { name: true } },
        stage: { select: { name: true, color: true } },
      },
      orderBy: { value: "desc" },
      take: 10,
    });

    return NextResponse.json({
      totalContacts,
      leadsCount,
      contactsByStatus: Object.fromEntries(contactsByStatus.map((c: { status: string; _count: number }) => [c.status, c._count])),
      openDealsCount,
      pipelineValue,
      weightedValue,
      pipelineStages,
      recentContacts,
      recentDeals,
      recentActivities,
      topDeals,
    });
  } catch (error) {
    console.error("CRM dashboard stats error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
