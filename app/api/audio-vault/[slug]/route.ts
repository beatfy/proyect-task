import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const share = await prisma.audioVaultShare.findUnique({
      where: { slug },
      include: { user: { select: { name: true } } },
    });

    if (!share || !share.isActive) {
      return NextResponse.json({ error: "Demo no encontrado" }, { status: 404 });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json({ error: "Este link ha expirado" }, { status: 410 });
    }

    if (share.maxPlays && share.playCount >= share.maxPlays) {
      return NextResponse.json({ error: "Se ha alcanzado el máximo de reproducciones" }, { status: 410 });
    }

    return NextResponse.json({
      title: share.title,
      artistName: share.artistName || share.user?.name || "Unknown",
      fileName: share.fileName,
      fileUrl: share.fileUrl,
      playCount: share.playCount,
    });
  } catch (error) {
    console.error("Get public audio error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const share = await prisma.audioVaultShare.findUnique({
      where: { slug },
      include: { user: true },
    });

    if (!share || !share.isActive) {
      return NextResponse.json({ error: "Demo no encontrado" }, { status: 404 });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json({ error: "Expirado" }, { status: 410 });
    }

    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const referrer = request.headers.get("referer") || null;

    await prisma.$transaction(async (tx) => {
      await tx.audioVaultPlay.create({
        data: { id: cuid(), shareId: share.id, visitorIp: clientIp, referrer },
      });

      await tx.audioVaultShare.update({
        where: { id: share.id },
        data: { playCount: { increment: 1 } },
      });
    });

    const totalPlays = share.playCount + 1;

    await prisma.notification.create({
      data: {
        id: cuid(),
        userId: share.userId,
        type: "AUDIO_PLAY",
        title: "Alguien escuchó tu demo",
        content: `"${share.title}" fue reproducido por un A&R/visitante. Total: ${totalPlays} reproducciones.`,
        data: { shareId: share.id, slug: share.slug, referrer, totalPlays },
      },
    });

    return NextResponse.json({ success: true, totalPlays });
  } catch (error) {
    console.error("Audio play tracking error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
