import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: auth.organizationId },
      include: {
        tasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true, taskAssignees: { select: { user: { select: { name: true, email: true } } } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) return apiError("Proyecto no encontrado", 404);
    return Response.json(project);
  }

  const projects = await prisma.project.findMany({
    where: { organizationId: auth.organizationId },
    select: {
      id: true, name: true, description: true, status: true, createdAt: true, updatedAt: true,
      clientContext: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({ projects });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { name, description, status } = body;

  if (!name) return apiError("name es requerido", 400);

  const project = await prisma.project.create({
    data: {
      id: cuid(),
      name,
      description: description || null,
      status: status || "ACTIVE",
      organizationId: auth.organizationId,
    },
  });

  return Response.json(project, { status: 201 });
}
