import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    + "-" + Math.random().toString(36).substring(2, 6);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const epks = await prisma.ePK.findMany({
      where: { userId: authResult.userId },
      include: { _count: { select: { views: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(epks);
  } catch (error) {
    console.error("Get EPKs error:", error);
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
    const { artistName, bio, photoUrl, coverUrl, soundcloudUrl, spotifyUrl, instagramUrl, websiteUrl, tracks, highlights } = body;

    if (!artistName) {
      return NextResponse.json({ error: "artistName es requerido" }, { status: 400 });
    }

    let slug = generateSlug(artistName);
    let exists = await prisma.ePK.findUnique({ where: { slug } });
    while (exists) {
      slug = generateSlug(artistName);
      exists = await prisma.ePK.findUnique({ where: { slug } });
    }

    const epk = await prisma.ePK.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        slug,
        artistName,
        bio: bio || null,
        photoUrl: photoUrl || null,
        coverUrl: coverUrl || null,
        soundcloudUrl: soundcloudUrl || null,
        spotifyUrl: spotifyUrl || null,
        instagramUrl: instagramUrl || null,
        websiteUrl: websiteUrl || null,
        tracks: tracks || null,
        highlights: highlights || null,
      },
    });

    return NextResponse.json(epk);
  } catch (error) {
    console.error("Create EPK error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const epk = await prisma.ePK.update({
      where: { id, userId: authResult.userId },
      data,
    });

    return NextResponse.json(epk);
  } catch (error) {
    console.error("Update EPK error:", error);
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
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await prisma.ePK.delete({ where: { id, userId: authResult.userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete EPK error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
