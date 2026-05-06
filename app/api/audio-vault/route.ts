import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const shares = await prisma.audioVaultShare.findMany({
      where: { userId: authResult.userId },
      include: { _count: { select: { plays: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(shares);
  } catch (error) {
    console.error("Get audio vault error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { title, artistName, fileUrl, fileName, expiresAt, maxPlays, organizationId } = body;

    if (!title || !fileUrl) return NextResponse.json({ error: "title y fileUrl requeridos" }, { status: 400 });

    let slug = generateSlug();
    let exists = await prisma.audioVaultShare.findUnique({ where: { slug } });
    while (exists) { slug = generateSlug(); exists = await prisma.audioVaultShare.findUnique({ where: { slug } }); }

    const share = await prisma.audioVaultShare.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        title,
        artistName: artistName || null,
        fileUrl,
        fileName: fileName || "demo.mp3",
        slug,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxPlays: maxPlays || null,
        organizationId: organizationId || null,
      },
    });

    return NextResponse.json(share);
  } catch (error) {
    console.error("Create audio share error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await prisma.audioVaultShare.delete({ where: { id, userId: authResult.userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete audio share error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
