import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/mail/config - Check if user has IMAP config
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const config = await prisma.emailConfig.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        host: true,
        port: true,
        email: true,
        ssl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ configured: !!config, config });
  } catch {
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

// POST /api/mail/config - Save IMAP config
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { host, port, email, password, ssl } = body;

    if (!host || !email || !password) {
      return NextResponse.json(
        { error: "Servidor, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Encrypt password
    const { encrypt } = await import("@/lib/email-crypto");
    const encryptedPassword = encrypt(password);

    // Test connection before saving
    const { testConnection } = await import("@/lib/imap");
    const testResult = await testConnection({
      host,
      port: port || 993,
      email,
      password,
      ssl: ssl !== false,
    });

    if (!testResult.success) {
      return NextResponse.json(
        { error: `No se pudo conectar: ${testResult.error}` },
        { status: 400 }
      );
    }

    const { randomUUID } = await import("crypto");

    // Upsert config
    const config = await prisma.emailConfig.upsert({
      where: { userId: session.user.id },
      update: {
        host,
        port: port || 993,
        email,
        encryptedPassword,
        ssl: ssl !== false,
      },
      create: {
        id: randomUUID(),
        host,
        port: port || 993,
        email,
        encryptedPassword,
        ssl: ssl !== false,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        host: config.host,
        port: config.port,
        email: config.email,
        ssl: config.ssl,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error al guardar configuración" },
      { status: 500 }
    );
  }
}
