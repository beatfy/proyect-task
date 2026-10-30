import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForProjects, getPreviousBillingPeriod } from "@/lib/billing";

// Auto-generate invoices for all projects with monthlyFee > 0
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    let { month, year } = getPreviousBillingPeriod(now);

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
      select: { id: true, monthlyFee: true },
    });

    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { created, total } = await generateInvoicesForProjects(projects, month, year, dueDate);

    return NextResponse.json({ created, total });
  } catch (error) {
    console.error("Generate invoices error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
