import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const habit = await prisma.bulletJournalHabit.findFirst({
      where: { id, userId: authResult.userId },
    });

    if (!habit) {
      return NextResponse.json({ error: "Hábito no encontrado o no autorizado" }, { status: 404 });
    }

    // Delete the habit (prisma cascade deletes logs automatically)
    await prisma.bulletJournalHabit.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete habit error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
