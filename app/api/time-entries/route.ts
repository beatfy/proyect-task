import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const userIdParam = searchParams.get("userId");

    const whereClause: Record<string, unknown> = {};

    if (taskId) {
      whereClause.taskId = taskId;
    }
    // "me" or omitting userId → use current session user
    if (userIdParam && userIdParam !== "me") {
      whereClause.userId = userIdParam;
    } else {
      whereClause.userId = authResult.userId;
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        task: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json(timeEntries);
  } catch (error) {
    console.error("Get time entries error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, startTime, endTime, description, action } = body;

    // Start timer
    if (action === "start") {
      if (!taskId) {
        return NextResponse.json({ error: "taskId es requerido" }, { status: 400 });
      }

      // Check if there's already a running timer for this user
      const running = await prisma.timeEntry.findFirst({
        where: {
          userId: authResult.userId,
          endTime: null,
        },
      });

      if (running) {
        return NextResponse.json(
          { error: "Ya tienes un timer activo. Detenlo antes de iniciar otro." },
          { status: 400 }
        );
      }

      const timeEntry = await prisma.timeEntry.create({
        data: {
          id: cuid(),
          taskId,
          userId: authResult.userId,
          startTime: startTime ? new Date(startTime) : new Date(),
          description: description || null,
        },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json(timeEntry);
    }

    // Stop timer
    if (action === "stop") {
      const entryId = body.id;
      if (!entryId) {
        return NextResponse.json({ error: "id es requerido para detener" }, { status: 400 });
      }

      const entry = await prisma.timeEntry.findUnique({
        where: { id: entryId },
      });

      if (!entry || entry.userId !== authResult.userId) {
        return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
      }

      if (entry.endTime) {
        return NextResponse.json({ error: "Este timer ya está detenido" }, { status: 400 });
      }

      const endTimeValue = endTime ? new Date(endTime) : new Date();
      const duration = Math.floor(
        (endTimeValue.getTime() - new Date(entry.startTime).getTime()) / 1000
      );

      const updated = await prisma.timeEntry.update({
        where: { id: entryId },
        data: {
          endTime: endTimeValue,
          duration,
        },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json(updated);
    }

    // Manual time entry
    if (!taskId || !startTime) {
      return NextResponse.json(
        { error: "taskId y startTime son requeridos" },
        { status: 400 }
      );
    }

    const durationValue = endTime
      ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      : null;

    const timeEntry = await prisma.timeEntry.create({
      data: {
        id: cuid(),
        taskId,
        userId: authResult.userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        duration: durationValue,
        description: description || null,
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(timeEntry);
  } catch (error) {
    console.error("Create time entry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!entry || entry.userId !== authResult.userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.timeEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete time entry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
