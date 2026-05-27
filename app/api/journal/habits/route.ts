import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET - List habits
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const habits = await prisma.bulletJournalHabit.findMany({
      where: { userId: authResult.userId, active: true },
      orderBy: { order: "asc" },
      include: {
        logs: {
          where: {
            date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    return NextResponse.json(habits);
  } catch (error) {
    console.error("Journal habits error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST - Create habit
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { name, color, icon, targetDays } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    const habit = await prisma.bulletJournalHabit.create({
      data: {
        userId: authResult.userId,
        name,
        color: color || "#C75B39",
        icon: icon || null,
        targetDays: targetDays || 7,
      },
    });

    return NextResponse.json(habit);
  } catch (error) {
    console.error("Create habit error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
