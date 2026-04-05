import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { cuid } from "@/lib/utils";
import { commentCreateSchema } from "@/lib/validations/comment";

// GET comments for a task
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId requerido" }, { status: 400 });
  }

  try {
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json(comments);
  } catch {
    return NextResponse.json({ error: "Error al obtener comentarios" }, { status: 500 });
  }
}

// POST create comment
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = commentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => i.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { taskId, content } = parsed.data;

    // Get task info for notification
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, creatorId: true, assigneeId: true },
    });

    const comment = await prisma.comment.create({
      data: {
        id: cuid(),
        taskId,
        content: content.trim(),
        authorId: authResult.userId
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } }
      }
    });

    // Notify task creator and assignee (if different from commenter)
    const notifyUsers = new Set<string>();
    if (task?.creatorId && task.creatorId !== authResult.userId) notifyUsers.add(task.creatorId);
    if (task?.assigneeId && task.assigneeId !== authResult.userId) notifyUsers.add(task.assigneeId);

    for (const userId of notifyUsers) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId,
          type: "COMMENT_ADDED",
          title: `Nuevo comentario en: ${task?.title || "Tarea"}`,
          content: `${"Scytale"}: ${content.trim().substring(0, 100)}`,
          data: { taskId, commentId: comment.id },
        },
      });
    }

    return NextResponse.json(comment);
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 });
  }
}

// DELETE comment - only the author can delete their own comments
export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    // Verify ownership: only the comment author can delete
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 });
    }

    if (comment.authorId !== authResult.userId) {
      return NextResponse.json({ error: "Solo puedes eliminar tus propios comentarios" }, { status: 403 });
    }

    await prisma.comment.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar comentario" }, { status: 500 });
  }
}
