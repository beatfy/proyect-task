import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// Auto-generate invoices for all projects with monthlyFee > 0
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Calculate previous month
    const now = new Date();
    let month = now.getMonth(); // 0-indexed, so current month - 1 = previous month
    let year = now.getFullYear();
    if (month === 0) { month = 12; year--; } // January → December prev year

    // Override if body provides values
    const body = await request.json().catch(() => ({}));
    if (body.month) month = parseInt(body.month);
    if (body.year) year = parseInt(body.year);

    // Find all organizations where user is OWNER or ADMIN
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    // Get projects with fee where user is member (OWNER/ADMIN) OR belongs to user's admin orgs
    const projects = await prisma.project.findMany({
      where: {
        monthlyFee: { gt: 0 },
        OR: [
          { members: { some: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } } } },
          { organizationId: { in: orgIds } },
        ],
      },
    });

    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // today + 7 days
    let created = 0;

    for (const project of projects) {
      // Skip if already exists
      const existing = await prisma.invoice.findUnique({
        where: { projectId_month_year: { projectId: project.id, month, year } },
      });
      if (existing) continue;

      await prisma.invoice.create({
        data: {
          id: cuid(),
          projectId: project.id,
          month,
          year,
          amount: project.monthlyFee,
          dueDate,
        },
      });
      created++;
    }

    return NextResponse.json({ created, total: projects.length });
  } catch (error) {
    console.error("Generate invoices error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
