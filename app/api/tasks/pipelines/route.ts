import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { canAccessProject, verifyOrgMembership } from "@/lib/tenant";

const defaultStages = [
  { name: "Por hacer", color: "#64748b", position: 0 },
  { name: "En progreso", color: "#3b82f6", position: 1 },
  { name: "En revisión", color: "#eab308", position: 2 },
  { name: "Hecho", color: "#22c55e", position: 3 },
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const organizationId = searchParams.get("organizationId");

    const where: Record<string, unknown> = {};
    if (projectId) {
      const hasAccess = await canAccessProject(authResult.userId, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
      where.projectId = projectId;
    } else if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      where.organizationId = organizationId;
      where.projectId = null;
    } else {
      where.projectId = null;
      where.organizationId = null;
    }

    let pipelines = await prisma.taskPipeline.findMany({
      where,
      include: {
        stages: {
          orderBy: { position: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    // If no pipelines found, initialize a default one
    if (pipelines.length === 0) {
      let pipelineName = "General";
      if (projectId) {
        const proj = await prisma.project.findUnique({ where: { id: projectId } });
        if (proj) pipelineName = `Tablero ${proj.name}`;
      }

      const newPipeline = await prisma.taskPipeline.create({
        data: {
          id: cuid(),
          name: pipelineName,
          isDefault: true,
          projectId: projectId || null,
          organizationId: organizationId || null,
          stages: {
            create: defaultStages.map(stage => ({
              id: cuid(),
              name: stage.name,
              color: stage.color,
              position: stage.position,
            }))
          }
        },
        include: {
          stages: {
            orderBy: { position: "asc" }
          }
        }
      });
      pipelines = [newPipeline];
    }

    return NextResponse.json(pipelines);
  } catch (error) {
    console.error("Get task pipelines error:", error);
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
    const { name, projectId, organizationId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    if (projectId) {
      const hasAccess = await canAccessProject(authResult.userId, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }
    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const pipeline = await prisma.taskPipeline.create({
      data: {
        id: cuid(),
        name: name.trim(),
        projectId: projectId || null,
        organizationId: organizationId || null,
        stages: {
          create: defaultStages.map(stage => ({
            id: cuid(),
            name: stage.name,
            color: stage.color,
            position: stage.position,
          }))
        }
      },
      include: {
        stages: {
          orderBy: { position: "asc" }
        }
      }
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error("Create task pipeline error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
