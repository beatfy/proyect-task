import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { MINDMAP_TEMPLATES } from "@/components/mindmap/MindMapTemplates";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");
    const favoriteOnly = searchParams.get("favorite") === "true";

    const whereClause: Record<string, unknown> = {
      userId: authResult.userId,
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (favoriteOnly) {
      whereClause.isFavorite = true;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const mindMaps = await prisma.mindMap.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(mindMaps);
  } catch (error) {
    console.error("Error al obtener mapas mentales:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, templateId, projectId, data } = body;

    let initialData = data;
    if (!initialData) {
      const template = MINDMAP_TEMPLATES.find((t) => t.id === templateId) || MINDMAP_TEMPLATES.find((t) => t.id === "blank");
      initialData = template ? template.data : MINDMAP_TEMPLATES[0].data;
    }

    const newMindMap = await prisma.mindMap.create({
      data: {
        id: cuid(),
        title: title || "Nuevo Mapa Mental",
        description: description || null,
        data: initialData,
        userId: authResult.userId,
        projectId: projectId || null,
        isFavorite: false,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json(newMindMap, { status: 201 });
  } catch (error) {
    console.error("Error al crear mapa mental:", error);
    return NextResponse.json({ error: "Error interno al crear el mapa mental" }, { status: 500 });
  }
}
