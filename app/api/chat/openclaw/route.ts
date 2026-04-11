import { NextRequest, NextResponse } from "next/server";
import { sendToTasky } from "@/lib/openclaw-proxy";

export async function POST(req: NextRequest) {
  try {
    const { message, userId, projectId, organizationId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const response = await sendToTasky(message, userId || "anonymous", projectId, organizationId);

    return NextResponse.json({ response });
  } catch (err) {
    console.error("OpenClaw proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach OpenClaw" },
      { status: 502 }
    );
  }
}
