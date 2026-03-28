import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cuid } from "@/lib/utils";

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
    const { taskId, content } = await request.json();

    if (!taskId || !content?.trim()) {
      return NextResponse.json({ error: "taskId y content requeridos" }, { status: 400 });
    }

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

// DELETE comment
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
    await prisma.comment.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar comentario" }, { status: 500 });
  }
}