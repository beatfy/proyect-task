import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { creatorId: session.user.id },
          { assigneeId: session.user.id },
        ],
      },
      include: {
        project: true,
        assignee: true,
        tags: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { title, description, status, priority, dueDate, projectId } = await request.json();

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || "TODO",
        priority: priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        creatorId: session.user.id,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}