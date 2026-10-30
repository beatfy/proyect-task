import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForProjects, getPreviousBillingPeriod } from "@/lib/billing";

// Cron endpoint to auto-generate invoices on the 1st of each month
// Call with: GET /api/billing/cron (secured via CRON_SECRET header)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls (fail-closed)
    const secret = process.env.CRON_SECRET;
    const cronSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    if (!secret || (cronSecret !== secret && authHeader !== `Bearer ${secret}`)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const { month, year } = getPreviousBillingPeriod(now);

    // Only run on the 1st of the month (or allow forced run with ?force=true)
    const { searchParams } = new URL(request.url);
    if (now.getDate() !== 1 && searchParams.get("force") !== "true") {
      return NextResponse.json({ message: "No es día 1, no se generaron facturas", created: 0 });
    }

    // Get all projects with monthlyFee > 0
    const projects = await prisma.project.findMany({
      where: { monthlyFee: { gt: 0 }, status: "ACTIVE" },
      select: { id: true, monthlyFee: true },
    });

    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { created, total } = await generateInvoicesForProjects(projects, month, year, dueDate);

    return NextResponse.json({
      message: `Cron ejecutado: ${created} facturas generadas para ${month}/${year}`,
      created,
      total,
      month,
      year,
    });
  } catch (error) {
    console.error("Billing cron error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
