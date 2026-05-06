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
      name: "Lanzamiento Estándar",
      title: "Lanzar nuevo single/EP",
      description:
        "## Checklist de Lanzamiento\n\n- [ ] Terminar master del track\n- [ ] Diseñar portada del single/EP\n- [ ] Subir a distribuidora (DistroKid/Record Union)\n- [ ] Configurar pre-save en Spotify\n- [ ] Crear pitch para playlists de Spotify\n- [ ] Preparar assets para redes sociales\n- [ ] Programar posts de anuncio\n- [ ] Enviar promo a DJs y medios\n- [ ] Crear campaña de Meta Ads (pre-save)\n- [ ] Confirmar fecha de release\n- [ ] Preparar link smart (Linkfire/tone.den)\n- [ ] Enviar a blogs y revistas musicales",
      status: "TODO",
      priority: "HIGH",
      tags: ["lanzamiento", "release"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Preparar Bolo",
      title: "Preparar evento en [SALA] - [FECHA]",
      description:
        "## Pre-producción del evento\n\n- [ ] Confirmar caché y condiciones con sala/promotor\n- [ ] Enviar contrato firmado\n- [ ] Enviar rider técnico\n- [ ] Enviar hospitality rider\n- [ ] Preparar tracklist/set\n- [ ] Grabar promo video del evento\n- [ ] Publicar en redes con countdown\n- [ ] Coordinar horarios de soundcheck\n- [ ] Preparar USBs de backup con el set\n- [ ] Confirmar logistics (viaje, hotel, parking)",
      status: "TODO",
      priority: "HIGH",
      tags: ["bolo", "evento", "live"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Demo a Sello",
      title: "Enviar demo a [NOMBRE DEL SELLO]",
      description:
        "## Pitch a discográfica\n\n- [ ] Finalizar master del demo\n- [ ] Investigar el sello (A&Rs, estilo, releases recientes)\n- [ ] Redactar email personalizado al A&R\n- [ ] Preparar links privados (Soundcloud / Beatfy Audio Vault)\n- [ ] Enviar email de seguimiento (semana +1)\n- [ ] Documentar respuesta",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["demo", "sello", "A&R"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Campaña Pre-save",
      title: "Campaña pre-save para [TÍTULO DEL TRACK]",
      description:
        "## Campaña de Pre-save\n\n- [ ] Configurar pre-save en Spotify for Artists\n- [ ] Crear landing page con link de pre-save\n- [ ] Diseñar assets visuales ( Stories, Reels, Banner )\n- [ ] Programar countdown en redes (7 días antes)\n- [ ] Crear Meta Ads con objetivo tráfico → pre-save\n- [ ] Enviar newsletter a fans\n- [ ] Contactar con curadores de playlists\n- [ ] Preparar post de release day\n- [ ] Activar Download Gate para fans",
      status: "TODO",
      priority: "HIGH",
      tags: ["pre-save", "campaña", "spotify"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Contenido Redes",
      title: "Crear contenido para redes - [SEMANA/TEMA]",
      description:
        "## Contenido semanal\n\n- [ ] Grabar clip en el estudio/DJ set\n- [ ] Editar Reel/TikTok (15-30 seg)\n- [ ] Escribir copy para Instagram\n- [ ] Escribir copy para TikTok\n- [ ] Hashtags relevantes\n- [ ] Programar posts (mejor horario)\n- [ ] Responder comentarios y DMs\n- [ ] Crear Stories con behind the scenes\n- [ ] Repost contenido de fans",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["redes", "contenido", "social"],
      isDefault: true,
    },
    {
      id: cuid(),
      name: "Remix/Colaboración",
      title: "Remix de [TRACK] con [ARTISTA]",
      description:
        "## Gestión de remix/colab\n\n- [ ] Recibir stems del original\n- [ ] Acordar split de royalties (split sheet)\n- [ ] Acordar deadline de entrega\n- [ ] Producir el remix\n- [ ] Enviar primer borrador para feedback\n- [ ] Aplicar revisiones\n- [ ] Master final\n- [ ] Gestionar permisos de uso de samples\n- [ ] Coordinar fecha de lanzamiento\n- [ ] Acordar estrategia de promoción conjunta",
      status: "TODO",
      priority: "MEDIUM",
      tags: ["remix", "collab", "producción"],
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
