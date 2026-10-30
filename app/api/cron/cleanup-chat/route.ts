import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE messages older than 7 days. Call via Vercel Cron (daily).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[cron/cleanup-chat] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
