import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST - Log habit
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { habitId, date, completed, value, notes } = await request.json();

    if (!habitId || !date) {
      return NextResponse.json({ error: "Hábito y fecha requeridos" }, { status: 400 });
    }

    // Verify habit belongs to user
    const habit = await prisma.bulletJournalHabit.findFirst({
      where: { id: habitId, userId: authResult.userId },
    });

    if (!habit) {
      return NextResponse.json({ error: "Hábito no encontrado" }, { status: 404 });
    }

    const log = await prisma.bulletJournalHabitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: new Date(date),
        },
      },
      create: {
        habitId,
        date: new Date(date),
        completed: completed || false,
        value: value || null,
        notes: notes || null,
      },
      update: {
        completed: completed !== undefined ? completed : undefined,
        value: value !== undefined ? value : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error("Log habit error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
