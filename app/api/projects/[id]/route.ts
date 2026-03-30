import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isProjectAdmin } from "@/lib/authz";

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

  // Authorization: only project admins (OWNER/ADMIN) can delete
  const authorized = await isProjectAdmin(session.user.id, id);
  if (!authorized) {
    return NextResponse.json({ error: "Solo los administradores del proyecto pueden eliminarlo" }, { status: 403 });
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // POST on /api/projects/[id] = Duplicate project
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const original = await prisma.project.findUnique({
      where: { id },
      include: {
        members: true,
        tasks: { include: { tags: true } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Generate a new ID for the duplicated project
    const { randomUUID } = await import("crypto");
    const newProjectId = randomUUID();
    const userId = session.user.id;

    // Create the duplicated project
    const duplicated = await prisma.project.create({
      data: {
        id: newProjectId,
        name: `${original.name} (copia)`,
        description: original.description,
        color: original.color,
        status: "ACTIVE",
        members: {
          create: {
            id: randomUUID(),
            userId,
            role: "OWNER",
          },
        },
        tasks: {
          create: original.tasks.map((task) => ({
            id: randomUUID(),
            title: task.title,
            description: task.description,
            status: "TODO" as const,
            priority: task.priority,
            order: task.order,
            creatorId: userId,
            tags: {
              create: task.tags.map((tag) => ({
                id: randomUUID(),
                name: tag.name,
                color: tag.color,
              })),
            },
          })),
        },
      },
      include: {
        members: true,
        tasks: true,
      },
    });

    return NextResponse.json(duplicated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error al duplicar proyecto" },
      { status: 500 }
    );
  }
}
