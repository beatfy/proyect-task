import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const chatWhere: Record<string, unknown> = {
      agentId: "doc",
      role: "user",
    };
    if (organizationId) chatWhere.organizationId = organizationId;

    const toolWhere: Record<string, unknown> = {
      prompt: "doc_tool_call",
    };
    if (organizationId) toolWhere.organizationId = organizationId;

    // 1. Total queries (user messages to Doc)
    const totalQueries = await prisma.chatMessage.count({
      where: chatWhere,
    });

    // 2. Tool calls (TaskyUsage entries for Doc)
    const toolUsages = await prisma.taskyUsage.findMany({
      where: toolWhere,
      select: { toolsUsed: true, createdAt: true },
    });

    const totalTools = toolUsages.reduce((sum: number, u: { toolsUsed: string[] }) => sum + u.toolsUsed.length, 0);

    // 3. Queries per day (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyChats = await prisma.chatMessage.groupBy({
      by: ["createdAt"],
      where: {
        ...chatWhere,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    const queriesByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      queriesByDay[key] = 0;
    }
    for (const dc of dailyChats) {
      const key = dc.createdAt.toISOString().split("T")[0];
      if (queriesByDay[key] !== undefined) {
        queriesByDay[key] = (queriesByDay[key] || 0) + dc._count;
      }
    }

    // 4. Top 5 tools
    const toolCounts: Record<string, number> = {};
    for (const u of toolUsages) {
      for (const t of u.toolsUsed) {
        toolCounts[t] = (toolCounts[t] || 0) + 1;
      }
    }
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      totalQueries,
      totalTools,
      queriesByDay,
      topTools,
    });
  } catch (error) {
    console.error("Doc usage API error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
