import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const where = organizationId && organizationId !== "all" ? { organizationId } : {};
    const gates = await prisma.downloadGate.findMany({
      where,
      include: { _count: { select: { downloads: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(gates);
  } catch (error) {
    console.error("Get download gates error:", error);
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
    const { title, description, fileUrl, fileName, fileType, fileSize, organizationId, expiresAt, maxDownloads } = body;

    if (!title || !fileUrl) {
      return NextResponse.json({ error: "title y fileUrl son requeridos" }, { status: 400 });
    }

    let slug = generateSlug();
    let exists = await prisma.downloadGate.findUnique({ where: { slug } });
    while (exists) {
      slug = generateSlug();
      exists = await prisma.downloadGate.findUnique({ where: { slug } });
    }

    const gate = await prisma.downloadGate.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        title,
        description: description || null,
        fileUrl,
        fileName: fileName || "download",
        fileType: fileType || "audio/mpeg",
        fileSize: fileSize || null,
        slug,
        organizationId: organizationId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxDownloads: maxDownloads || null,
      },
    });

    return NextResponse.json(gate);
  } catch (error) {
    console.error("Create download gate error:", error);
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

    await prisma.downloadGate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete download gate error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
