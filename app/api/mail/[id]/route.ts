import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/mail/[id] - Get single email detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
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
      console.error("[mail/[id]] Decryption error:", cryptoErr);
      return NextResponse.json(
        { error: "Error de configuración del servidor. Contacta al administrador." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";

    const { fetchEmail } = await import("@/lib/imap");
    const email = await fetchEmail(
      {
        host: config.host,
        port: config.port,
        email: config.email,
        password,
        ssl: config.ssl,
      },
      id,
      folder
    );

    if (!email) {
      return NextResponse.json({ error: "Email no encontrado" }, { status: 404 });
    }

    return NextResponse.json(email);
  } catch (err) {
    console.error("[mail/[id]] Error:", err);
    return NextResponse.json(
      { error: "Error al obtener email. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
