import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET() {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: { userId: authResult.userId },
        },
      },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
        members: {
          where: { userId: authResult.userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo: org.logo,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      projectCount: org._count.projects,
      role: org.members[0]?.role || "MEMBER",
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get organizations error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json(
        { error: "Sesión inválida. Por favor, cierra sesión y vuelve a iniciar." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    let slug = slugify(name.trim());

    // Ensure slug uniqueness
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const organization = await prisma.organization.create({
      data: {
        id: cuid(),
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        members: {
          create: {
            id: cuid(),
            userId: authResult.userId,
            role: "OWNER",
          },
        },
      },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Create organization error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
