import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

// Seed default templates if they don't exist
async function seedDefaults() {
  const count = await prisma.taskTemplate.count({ where: { isDefault: true } });
  if (count > 0) return;

  const defaults = [
    {
      id: cuid(),
      name: "Bug fix",
      title: "Fix: [descripción del bug]",
      description:
        "## Bug\n\n**Comportamiento actual:** \n\n**Comportamiento esperado:** \n\n**Pasos para reproducir:** \n1. \n\n**Entorno:** \n\n**Notas adicionales:** ",
      status: "TODO",
      priority: "HIGH",
      tags: ["bug", "fix"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Feature",
      title: "Feature: [nombre de la feature]",
      description:
        "## Descripción\n\n**Como** [rol]\n**Quiero** [funcionalidad]\n**Para** [beneficio]\n\n## Criterios de aceptación\n- [ ] \n\n## Notas técnicas\n",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["feature", "enhancement"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Review",
      title: "Review: [elemento a revisar]",
      description:
        "## Elemento a revisar\n\n**Tipo:** (código / documento / diseño)\n**URL / Referencia:** \n\n## Checklist de revisión\n- [ ] Funcionalidad correcta\n- [ ] Código limpio\n- [ ] Tests pasan\n- [ ] Documentación actualizada\n\n## Comentarios\n",
      status: "INREVIEW",
      priority: "MEDIUM",
      tags: ["review"],
      isDefault: true,
    },
  ];

  await prisma.taskTemplate.createMany({ data: defaults });
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Ensure defaults exist
    await seedDefaults();

    const templates = await prisma.taskTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Get templates error:", error);
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
    const { name, title, description, status, priority, tags } = body;

    if (!name || !title) {
      return NextResponse.json(
        { error: "nombre y título son requeridos" },
        { status: 400 }
      );
    }

    const template = await prisma.taskTemplate.create({
      data: {
        id: cuid(),
        name,
        title,
        description: description || null,
        status: status || "TODO",
        priority: priority || "NONE",
        tags: tags || null,
        isDefault: false,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const template = await prisma.taskTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    if (template.isDefault) {
      return NextResponse.json(
        { error: "No se pueden eliminar plantillas predeterminadas" },
        { status: 400 }
      );
    }

    await prisma.taskTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
