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

    const body = await request.json();
    const month = parseInt(body.month) || new Date().getMonth() + 1;
    const year = parseInt(body.year) || new Date().getFullYear();

    // Get projects with fee where user is member
    const projects = await prisma.project.findMany({
      where: {
        monthlyFee: { gt: 0 },
        members: { some: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } } },
      },
    });

    const dueDate = new Date(year, month, 15); // 15th of the month
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
