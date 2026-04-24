import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Get total contacts by status
    const contactsByStatus = await prisma.contact.groupBy({
      by: ["status"],
      where: organizationId ? { organizationId } : undefined,
      _count: true,
    });

    const totalContacts = contactsByStatus.reduce((sum, c) => sum + c._count, 0);

    // Get leads count
    const leadsCount = contactsByStatus.find(c => c.status === "LEAD")?._count || 0;

    // Get open deals (not in "Cerrado Ganado" or "Cerrado Perdido" stages)
    const closedStages = await prisma.pipelineStage.findMany({
      where: {
        name: { in: ["Cerrado Ganado", "Cerrado Perdido"] },
      },
      select: { id: true },
    });

    const closedStageIds = closedStages.map(s => s.id);

    const openDeals = await prisma.deal.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        stageId: { notIn: closedStageIds },
      },
      include: {
        stage: { select: { name: true, position: true } },
      },
    });

    const openDealsCount = openDeals.length;

    // Total pipeline value
    const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);

    // Weighted pipeline value
    const weightedValue = openDeals.reduce((sum, d) => sum + (d.value * d.probability / 100), 0);

    // Deals by stage
    const dealsByStage = await prisma.deal.groupBy({
      by: ["stageId"],
      where: {
        ...(organizationId ? { organizationId } : {}),
      },
      _count: true,
      _sum: { value: true },
    });

    const stages = await prisma.pipelineStage.findMany({
      orderBy: { position: "asc" },
      include: {
        deals: {
          where: organizationId ? { organizationId } : undefined,
        },
      },
    });

    const pipelineStages = stages.map(stage => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      dealCount: stage.deals.length,
      totalValue: stage.deals.reduce((sum, d) => sum + d.value, 0),
    }));

    // Recent contacts
    const recentContacts = await prisma.contact.findMany({
      where: organizationId ? { organizationId } : undefined,
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, company: true, status: true, createdAt: true },
    });

    // Recent deals
    const recentDeals = await prisma.deal.findMany({
      where: organizationId ? { organizationId } : undefined,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { name: true } },
        stage: { select: { name: true, color: true } },
      },
    });

    // Recent activities (10 for dashboard)
    const recentActivities = await prisma.activity.findMany({
      where: {}, // Activities don't have organizationId filter at this level
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
        ...(organizationId ? { organizationId } : {}),
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
      contactsByStatus: Object.fromEntries(contactsByStatus.map(c => [c.status, c._count])),
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
