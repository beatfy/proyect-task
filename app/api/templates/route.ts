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
      name: "Auditoría SEO Inicial",
      title: "Auditoría SEO para [CLIENTE]",
      description:
        "## Auditoría SEO Completa\n\n- [ ] Análisis técnico (velocidad, mobile, indexación)\n- [ ] Auditoría de keywords actuales\n- [ ] Análisis de competencia directa\n- [ ] Revisión de on-page (títulos, meta, headings)\n- [ ] Auditoría de backlinks\n- [ ] Identificación de oportunidades de contenido\n- [ ] Reporte de errores técnicos\n- [ ] Priorización de acciones\n- [ ] Presentación de resultados al cliente",
      status: "TODO",
      priority: "HIGH",
      tags: ["seo", "auditoría", "análisis"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Setup Campaña Google Ads",
      title: "Configurar campaña SEM para [CLIENTE]",
      description:
        "## Configuración de Campaña SEM\n\n- [ ] Definición de objetivos y KPIs\n- [ ] Investigación de keywords (intención de búsqueda)\n- [ ] Estructura de campañas y grupos de anuncios\n- [ ] Redacción de anuncios (3 variantes mínimo)\n- [ ] Configuración de extensiones\n- [ ] Definición de presupuesto diario\n- [ ] Configuración de pujas automáticas\n- [ ] Implementación de conversion proyectoing\n- [ ] Revisión de landing pages\n- [ ] Cliente y monitorización inicial",
      status: "TODO",
      priority: "HIGH",
      tags: ["sem", "google-ads", "ppc"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Calendario Editorial Mensual",
      title: "Planificar contenido mensual para [CLIENTE]",
      description:
        "## Calendario Editorial\n\n- [ ] Análisis de temas trending del sector\n- [ ] Definición de pilares de contenido\n- [ ] Planificación de posts por red social\n- [ ] Creación de copy para cada post\n- [ ] Diseño de gráficos y visuals\n- [ ] Programación de publicaciones\n- [ ] Planificación de Stories/Reels\n- [ ] Estrategia de hashtags\n- [ ] Calendario de campañas especiales\n- [ ] Métricas objetivo por publicación",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["social", "contenido", "editorial"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Reporte de Métricas Semanal",
      title: "Reporte semanal de [CLIENTE]",
      description:
        "## Reporte de Rendimiento Semanal\n\n- [ ] Recopilar datos de Google Analytics\n- [ ] Métricas de campañas activas (Ads, Social)\n- [ ] Análisis de tráfico orgánico (SEO)\n- [ ] Engagement en redes sociales\n- [ ] Conversiones y leads generados\n- [ ] Comparativa vs semana anterior\n- [ ] Identificación de oportunidades\n- [ ] Recomendaciones de optimización\n- [ ] Preparar presentación para cliente",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["reporte", "métricas", "análisis"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Optimización On-Page",
      title: "Optimización SEO on-page para [CLIENTE]",
      description:
        "## Optimización On-Page\n\n- [ ] Optimización de títulos SEO\n- [ ] Meta descriptions únicas\n- [ ] Estructura de headings (H1-H6)\n- [ ] Optimización de imágenes (alt, compresión)\n- [ ] Mejora de internal linking\n- [ ] Optimización de URLs\n- [ ] Mejora de velocidad de carga\n- [ ] Implementación de schema markup\n- [ ] Optimización para mobile\n- [ ] Revisión de contenido duplicado",
      status: "TODO",
      priority: "HIGH",
      tags: ["seo", "on-page", "optimización"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Estrategia de Contenidos",
      title: "Estrategia de contenidos para [CLIENTE]",
      description:
        "## Estrategia de Content Marketing\n\n- [ ] Análisis de buyer personas\n- [ ] Investigación de keywords de contenido\n- [ ] Definición de tone of voice\n- [ ] Plan de contenido blog (3 meses)\n- [ ] Estrategia de contenido visual\n- [ ] Calendario de publicaciones\n- [ ] Distribución por canales\n- [ ] Estrategia de repurposing\n- [ ] KPIs de contenido\n- [ ] Plan de promoción orgánica y paid",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["contenido", "estrategia", "seo", "social"],
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
    const { name, title, description, status, priority, tags, organizationId } = body;

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
        organizationId: organizationId || null,
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
