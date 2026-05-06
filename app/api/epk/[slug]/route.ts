import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const epk = await prisma.ePK.findUnique({
      where: { slug, isActive: true },
    });

    if (!epk) {
      return NextResponse.json({ error: "EPK no encontrado" }, { status: 404 });
    }

    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const referrer = request.headers.get("referer") || null;

    await prisma.ePKView.create({
      data: {
        id: cuid(),
        epkId: epk.id,
        visitorIp: clientIp,
        referrer,
      },
    });

    const totalViews = await prisma.ePKView.count({
      where: { epkId: epk.id },
    });

    await prisma.notification.create({
      data: {
        id: cuid(),
        userId: epk.userId,
        type: "EPK_VIEW",
        title: "Alguien vio tu Press Kit",
        content: `Tu EPK "${epk.artistName}" fue visitado. Total: ${totalViews} vistas.`,
        data: { epkId: epk.id, slug: epk.slug, referrer, totalViews },
      },
    });

    return NextResponse.json({
      artistName: epk.artistName,
      bio: epk.bio,
      photoUrl: epk.photoUrl,
      coverUrl: epk.coverUrl,
      soundcloudUrl: epk.soundcloudUrl,
      spotifyUrl: epk.spotifyUrl,
      instagramUrl: epk.instagramUrl,
      websiteUrl: epk.websiteUrl,
      tracks: epk.tracks,
      highlights: epk.highlights,
      totalViews,
    });
  } catch (error) {
    console.error("Get public EPK error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
