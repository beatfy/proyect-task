import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        members: true,
        tasks: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { name, description, color } = await request.json();

    const projectId = cuid();

    const project = await prisma.project.create({
      data: {
        id: projectId,
        name,
        description,
        color: color || "#6366f1",
        members: {
          create: {
            id: cuid(),
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}