import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cuid } from "@/lib/utils";
import { commentCreateSchema } from "@/lib/validations/comment";

// GET comments for a task
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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
  const session = await auth();
  if (!session?.user?.id) {
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

    const comment = await prisma.comment.create({
      data: {
        id: cuid(),
        taskId,
        content: content.trim(),
        authorId: session.user.id
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } }
      }
    });

    return NextResponse.json(comment);
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 });
  }
}

// DELETE comment - only the author can delete their own comments
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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

    if (comment.authorId !== session.user.id) {
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
