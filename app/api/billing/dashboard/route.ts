import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentYear = now.getFullYear();

    // Projects with monthlyFee > 0 for current user
    const projects = await prisma.project.findMany({
      where: {
        monthlyFee: { gt: 0 },
        members: { some: { userId: authResult.userId } },
      },
      select: {
        id: true,
        name: true,
        color: true,
        monthlyFee: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    const projectIds = projects.map((p: { id: string }) => p.id);

    // All invoices for those projects
    const invoices = await prisma.invoice.findMany({
      where: { projectId: { in: projectIds } },
    });

    // Current month invoices
    const currentMonthInvoices = invoices.filter(
      (i: { month: number; year: number }) => i.month === currentMonth && i.year === currentYear
    );

    const totalThisMonth = currentMonthInvoices.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const totalPaid = invoices.filter((i: { status: string }) => i.status === "PAID").reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const totalPending = invoices.filter((i: { status: string }) => i.status === "PENDING").reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const totalOverdue = invoices.filter((i: { status: string }) => i.status === "OVERDUE").reduce((s: number, i: { amount: number }) => s + i.amount, 0);

    // Per-project status
    const projectsWithStatus = projects.map((p: { id: string }) => {
      const pInvoices = invoices.filter((i: { projectId: string }) => i.projectId === p.id);
      const current = pInvoices.find(
        (i: { month: number; year: number }) => i.month === currentMonth && i.year === currentYear
      );
      return {
        ...p,
        currentInvoice: current || null,
        currentStatus: current?.status || "NONE",
      };
    });

    return NextResponse.json({
      totalThisMonth,
      totalPaid,
      totalPending,
      totalOverdue,
      projects: projectsWithStatus,
    });
  } catch (error) {
    console.error("Billing dashboard error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
