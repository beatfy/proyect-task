import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const mindMap = await prisma.mindMap.findFirst({
      where: {
        id,
        userId: authResult.userId,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (!mindMap) {
      return NextResponse.json({ error: "Mapa mental no encontrado" }, { status: 404 });
    }

    return NextResponse.json(mindMap);
  } catch (error) {
    console.error("Error al obtener mapa mental:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingMap = await prisma.mindMap.findFirst({
      where: {
        id,
        userId: authResult.userId,
      },
    });

    if (!existingMap) {
      return NextResponse.json({ error: "Mapa mental no encontrado" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.data !== undefined) updateData.data = body.data;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;
    if (body.projectId !== undefined) updateData.projectId = body.projectId;
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;

    const updatedMindMap = await prisma.mindMap.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json(updatedMindMap);
  } catch (error) {
    console.error("Error al actualizar mapa mental:", error);
    return NextResponse.json({ error: "Error interno al actualizar el mapa mental" }, { status: 500 });
  }
}

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

    const existingMap = await prisma.mindMap.findFirst({
      where: {
        id,
        userId: authResult.userId,
      },
    });

    if (!existingMap) {
      return NextResponse.json({ error: "Mapa mental no encontrado" }, { status: 404 });
    }

    await prisma.mindMap.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Mapa mental eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar mapa mental:", error);
    return NextResponse.json({ error: "Error interno al eliminar el mapa mental" }, { status: 500 });
  }
}
