import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE messages older than 7 days. Call via Vercel Cron (daily).
export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
