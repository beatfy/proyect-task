import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// Cron endpoint to auto-generate invoices on the 1st of each month
// Call with: GET /api/billing/cron (secured via CRON_SECRET header)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = request.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const month = now.getMonth() + 1; // 1-indexed
    const year = now.getFullYear();

    // Only run on the 1st of the month (or allow forced run with ?force=true)
    const { searchParams } = new URL(request.url);
    if (now.getDate() !== 1 && searchParams.get("force") !== "true") {
      return NextResponse.json({ message: "No es día 1, no se generaron facturas", created: 0 });
    }

    // Get all projects with monthlyFee > 0
    const projects = await prisma.project.findMany({
      where: { monthlyFee: { gt: 0 }, status: "ACTIVE" },
    });

    const dueDate = new Date(year, month, 1); // 1st of current month
    let created = 0;

    for (const project of projects) {
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

    return NextResponse.json({
      message: `Cron ejecutado: ${created} facturas generadas para ${month}/${year}`,
      created,
      total: projects.length,
      month,
      year,
    });
  } catch (error) {
    console.error("Billing cron error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
