import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForProjects, getPreviousBillingPeriod } from "@/lib/billing";

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const defaultPeriod = getPreviousBillingPeriod(now);
    const body = await request.json().catch(() => ({}));
    const month = Number(body.month) || defaultPeriod.month;
    const year = Number(body.year) || defaultPeriod.year;

    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    // Get all projects with monthlyFee > 0 where user is OWNER/ADMIN
    const projects = await prisma.project.findMany({
      where: {
        monthlyFee: { gt: 0 },
        OR: [
          { members: { some: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } } } },
          { organizationId: { in: orgIds } },
        ],
      },
      select: { id: true, monthlyFee: true },
    });

    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { created, total, results } = await generateInvoicesForProjects(
      projects,
      month,
      year,
      dueDate
    );

    return NextResponse.json({ month, year, created, total, results });
  } catch (error) {
    console.error("Generate invoices error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
