import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    let password: string;
    try {
      const { decrypt } = await import("@/lib/email-crypto");
      password = decrypt(config.encryptedPassword);
    } catch (cryptoErr) {
      console.error("[mail/inbox] Decryption error:", cryptoErr);
      return NextResponse.json(
        { error: "Error de configuración del servidor. Contacta al administrador." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const limit = parseInt(searchParams.get("limit") || "50");

    const { fetchInbox } = await import("@/lib/imap");
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
  } catch (err) {
    console.error("[mail/inbox] Error:", err);
    return NextResponse.json(
      { error: "Error al obtener emails. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
