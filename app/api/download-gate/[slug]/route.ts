import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const gate = await prisma.downloadGate.findUnique({
      where: { slug },
      include: { _count: { select: { downloads: true } }, user: { select: { name: true } } },
    });

    if (!gate || !gate.isActive) {
      return NextResponse.json({ error: "Download no encontrado" }, { status: 404 });
    }

    if (gate.expiresAt && new Date() > gate.expiresAt) {
      return NextResponse.json({ error: "Este link ha expirado" }, { status: 410 });
    }

    if (gate.maxDownloads && gate.downloadCount >= gate.maxDownloads) {
      return NextResponse.json({ error: "Se ha alcanzado el máximo de descargas" }, { status: 410 });
    }

    return NextResponse.json({
      title: gate.title,
      description: gate.description,
      fileName: gate.fileName,
      fileType: gate.fileType,
      artist: gate.user?.name || null,
    });
  } catch (error) {
    console.error("Get public download gate error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { email, name } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email válido es requerido" }, { status: 400 });
    }

    const gate = await prisma.downloadGate.findUnique({
      where: { slug },
      include: { user: true },
    });

    if (!gate || !gate.isActive) {
      return NextResponse.json({ error: "Download no encontrado" }, { status: 404 });
    }

    if (gate.expiresAt && new Date() > gate.expiresAt) {
      return NextResponse.json({ error: "Este link ha expirado" }, { status: 410 });
    }

    if (gate.maxDownloads && gate.downloadCount >= gate.maxDownloads) {
      return NextResponse.json({ error: "Se ha alcanzado el máximo de descargas" }, { status: 410 });
    }

    const existing = await prisma.downloadGateEntry.findUnique({
      where: { gateId_email: { gateId: gate.id, email } },
    });

    if (existing) {
      return NextResponse.json({ fileUrl: gate.fileUrl, fileName: gate.fileName, alreadyExists: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.downloadGateEntry.create({
        data: {
          id: cuid(),
          gateId: gate.id,
          email,
          name: name || null,
        },
      });

      await tx.downloadGate.update({
        where: { id: gate.id },
        data: { downloadCount: { increment: 1 } },
      });

      if (gate.organizationId) {
        await tx.contact.upsert({
          where: {
            id: cuid(),
          },
          create: {
            id: cuid(),
            name: name || email.split("@")[0],
            email,
            tags: ["Fan", "Download Gate"],
            status: "LEAD",
            organizationId: gate.organizationId,
          },
          update: {},
        });
      }
    });

    return NextResponse.json({ fileUrl: gate.fileUrl, fileName: gate.fileName });
  } catch (error) {
    console.error("Download gate submit error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
