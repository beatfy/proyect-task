import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT - Update entry
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, title, content, mood, completed, priority, tags } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const entry = await prisma.bulletJournalEntry.updateMany({
      where: { id, userId: authResult.userId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(mood !== undefined && { mood }),
        ...(completed !== undefined && { completed }),
        ...(priority !== undefined && { priority }),
        ...(tags !== undefined && { tags }),
      },
    });

    return NextResponse.json({ success: true, updated: entry.count });
  } catch (error) {
    console.error("Update journal entry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE - Delete entry
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.bulletJournalEntry.deleteMany({
      where: { id, userId: authResult.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete journal entry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
