import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Marcar todas como leídas
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark all read error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}