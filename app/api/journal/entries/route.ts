import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET - List entries
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const entries = await prisma.bulletJournalEntry.findMany({
      where: {
        userId: authResult.userId,
        ...(type && { type }),
        ...(dateFrom && dateTo && {
          date: {
            gte: new Date(dateFrom),
            lte: new Date(dateTo),
          },
        }),
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Journal entries error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST - Create entry
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { type, title, content, date, mood, priority, tags } = await request.json();

    if (!type || !date) {
      return NextResponse.json({ error: "Tipo y fecha son requeridos" }, { status: 400 });
    }

    const entry = await prisma.bulletJournalEntry.create({
      data: {
        userId: authResult.userId,
        type,
        title: title || null,
        content: content || "",
        date: new Date(date),
        mood: mood || null,
        priority: priority || "NONE",
        tags: tags || [],
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Create journal entry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
