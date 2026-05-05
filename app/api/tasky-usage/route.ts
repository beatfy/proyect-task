import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;

    const [total, usages] = await Promise.all([
      prisma.taskyUsage.count({ where }),
      prisma.taskyUsage.findMany({
        where,
        select: { toolsUsed: true, createdAt: true },
      }),
    ]);

    // Total tools executed
    const totalTools = usages.reduce((sum: number, u: { toolsUsed: string[] }) => sum + u.toolsUsed.length, 0);

    // Queries per day (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyCounts = await prisma.taskyUsage.groupBy({
      by: ["createdAt"],
      where: {
        ...where,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    // Group by date string
    const queriesByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      queriesByDay[key] = 0;
    }
    for (const dc of dailyCounts) {
      const key = dc.createdAt.toISOString().split("T")[0];
      if (queriesByDay[key] !== undefined) queriesByDay[key] = dc._count;
    }

    // Top 5 tools
    const toolCounts: Record<string, number> = {};
    for (const u of usages) {
      for (const t of u.toolsUsed) {
        toolCounts[t] = (toolCounts[t] || 0) + 1;
      }
    }
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      totalQueries: total,
      totalTools,
      queriesByDay,
      topTools,
    });
  } catch (error) {
    console.error("Ledy usage API error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
