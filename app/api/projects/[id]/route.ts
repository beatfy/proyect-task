import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Error al obtener proyecto" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, color, status } = body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        color,
        status
      }
    });

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Error al actualizar proyecto" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await prisma.project.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar proyecto" }, { status: 500 });
  }
}