import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/email-crypto";
import { fetchInbox } from "@/lib/imap";

// GET /api/mail/inbox - List emails
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const config = await prisma.emailConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return NextResponse.json({ error: "No hay configuración de email" }, { status: 404 });
    }

    const password = decrypt(config.encryptedPassword);
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const limit = parseInt(searchParams.get("limit") || "50");

    const emails = await fetchInbox(
      {
        host: config.host,
        port: config.port,
        email: config.email,
        password,
        ssl: config.ssl,
      },
      folder,
      limit
    );

    return NextResponse.json(emails);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error al obtener emails" },
      { status: 500 }
    );
  }
}
