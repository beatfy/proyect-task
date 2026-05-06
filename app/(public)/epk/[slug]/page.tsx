import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EPKViewerClient from "./EPKViewerClient";

export const metadata = { title: "Press Kit" };

export default async function EPKPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const epk = await prisma.ePK.findUnique({ where: { slug, isActive: true } });
  if (!epk) notFound();

  return <EPKViewerClient slug={slug} initialData={{
    artistName: epk.artistName,
    bio: epk.bio,
    photoUrl: epk.photoUrl,
    coverUrl: epk.coverUrl,
    soundcloudUrl: epk.soundcloudUrl,
    spotifyUrl: epk.spotifyUrl,
    instagramUrl: epk.instagramUrl,
    websiteUrl: epk.websiteUrl,
    tracks: epk.tracks as { title: string; url: string }[] | null,
    highlights: epk.highlights as string[] | null,
  }} />;
}
