import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DownloadGateClient from "./DownloadGateClient";

export const metadata = { title: "Download" };

export default async function DownloadGatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await prisma.downloadGate.findUnique({ where: { slug }, include: { user: true } });
  if (!gate || !gate.isActive) notFound();
  if (gate.expiresAt && new Date() > gate.expiresAt) notFound();

  return <DownloadGateClient slug={slug} title={gate.title} description={gate.description} artistName={gate.user?.name || null} />;
}
