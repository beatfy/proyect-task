import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/backup/export
 * Disaster recovery & platform resilience backup endpoint.
 * Protected by CRON_SECRET header/query OR authenticated admin user.
 * Exports database entities in structured JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecretHeader = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");

    const expectedCronSecret = process.env.CRON_SECRET;
    let isAuthorizedByCron = false;

    if (expectedCronSecret) {
      if (
        cronSecretHeader === expectedCronSecret ||
        querySecret === expectedCronSecret ||
        authHeader === `Bearer ${expectedCronSecret}`
      ) {
        isAuthorizedByCron = true;
      }
    }

    let userOrgIds: string[] = [];
    if (!isAuthorizedByCron) {
      const authResult = await authenticateRequest(request);
      if (!authResult) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }

      // Check if user is OWNER or ADMIN of any organization
      const memberships = await prisma.organizationMember.findMany({
        where: {
          userId: authResult.userId,
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { organizationId: true },
      });

      if (memberships.length === 0) {
        return NextResponse.json(
          { error: "Requiere rol ADMIN u OWNER para exportar backups" },
          { status: 403 }
        );
      }

      userOrgIds = memberships.map((m) => m.organizationId);
    }

    const requestedOrgId = searchParams.get("organizationId");
    const targetOrgId = requestedOrgId || (userOrgIds.length === 1 ? userOrgIds[0] : null);

    // Build filter for tenant or global
    const orgFilter = targetOrgId ? { organizationId: targetOrgId } : {};
    const projectFilter = targetOrgId ? { organizationId: targetOrgId } : {};
    const taskFilter = targetOrgId
      ? { OR: [{ organizationId: targetOrgId }, { project: { organizationId: targetOrgId } }] }
      : {};

    const [
      organizations,
      projects,
      tasks,
      pipelines,
      contacts,
      deals,
      timeEntries,
      invoices,
    ] = await Promise.all([
      prisma.organization.findMany({
        where: targetOrgId ? { id: targetOrgId } : {},
        select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
      }),
      prisma.project.findMany({
        where: projectFilter,
        select: { id: true, name: true, description: true, color: true, organizationId: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: taskFilter,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          organizationId: true,
          pipelineId: true,
          stageId: true,
          creatorId: true,
          assigneeId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.taskPipeline.findMany({
        where: orgFilter,
        include: {
          stages: { select: { id: true, name: true, color: true, position: true } },
        },
      }),
      prisma.contact.findMany({
        where: orgFilter,
        select: { id: true, name: true, email: true, phone: true, company: true, status: true, organizationId: true },
      }),
      prisma.deal.findMany({
        where: orgFilter,
        select: { id: true, title: true, value: true, stageId: true, pipelineId: true, organizationId: true },
      }),
      prisma.timeEntry.findMany({
        where: targetOrgId ? { task: { organizationId: targetOrgId } } : {},
        select: { id: true, taskId: true, userId: true, duration: true, startTime: true, description: true },
        take: 5000,
      }),
      prisma.invoice.findMany({
        where: targetOrgId ? { project: { organizationId: targetOrgId } } : {},
        select: { id: true, projectId: true, amount: true, status: true, month: true, year: true, dueDate: true },
      }),
    ]);

    const backupPayload = {
      meta: {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        format: "xtask-neon-backup",
        scope: targetOrgId ? `organization:${targetOrgId}` : "full",
        counts: {
          organizations: organizations.length,
          projects: projects.length,
          tasks: tasks.length,
          pipelines: pipelines.length,
          contacts: contacts.length,
          deals: deals.length,
          timeEntries: timeEntries.length,
          invoices: invoices.length,
        },
      },
      data: {
        organizations,
        projects,
        tasks,
        pipelines,
        contacts,
        deals,
        timeEntries,
        invoices,
      },
    };

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="xtask-backup-${new Date().toISOString().split("T")[0]}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Error interno al generar backup" }, { status: 500 });
  }
}
