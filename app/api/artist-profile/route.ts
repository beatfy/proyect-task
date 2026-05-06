import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let profile = await prisma.artistProfile.findUnique({
      where: { userId: authResult.userId },
    });

    if (!profile) {
      profile = await prisma.artistProfile.create({
        data: { id: cuid(), userId: authResult.userId },
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Get artist profile error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { stageName, genre, techRiderUrl, techRiderName, hospitalityUrl, hospitalityName, spotifyUrl, soundcloudUrl, instagramUrl, bio } = body;

    const profile = await prisma.artistProfile.upsert({
      where: { userId: authResult.userId },
      create: {
        id: cuid(),
        userId: authResult.userId,
        stageName,
        genre,
        techRiderUrl,
        techRiderName,
        hospitalityUrl,
        hospitalityName,
        spotifyUrl,
        soundcloudUrl,
        instagramUrl,
        bio,
      },
      update: {
        stageName,
        genre,
        techRiderUrl,
        techRiderName,
        hospitalityUrl,
        hospitalityName,
        spotifyUrl,
        soundcloudUrl,
        instagramUrl,
        bio,
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Update artist profile error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
