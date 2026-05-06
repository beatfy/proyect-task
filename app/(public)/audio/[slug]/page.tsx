import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AudioPlayerClient from "./AudioPlayerClient";

export const metadata = { title: "Demo" };

export default async function AudioSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await prisma.audioVaultShare.findUnique({
    where: { slug, isActive: true },
    include: { user: { select: { name: true } } },
  });
  if (!share) notFound();
  if (share.expiresAt && new Date() > share.expiresAt) notFound();
  if (share.maxPlays && share.playCount >= share.maxPlays) notFound();

  return <AudioPlayerClient slug={slug} title={share.title} artistName={share.artistName || share.user?.name || "Unknown"} fileUrl={share.fileUrl} />;
}
