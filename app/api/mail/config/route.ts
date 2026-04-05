import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

// GET /api/mail/config - Check if user has IMAP config
export async function GET() {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }, { status: 401 });
  }

  try {
    const config = await prisma.emailConfig.findUnique({
      where: { userId: authResult.userId },
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
  } catch (err) {
    console.error("[mail/config] GET error:", err);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

// POST /api/mail/config - Save IMAP config
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }, { status: 401 });
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
    let encryptedPassword: string;
    try {
      const { encrypt } = await import("@/lib/email-crypto");
      encryptedPassword = encrypt(password);
    } catch (cryptoErr) {
      console.error("[mail/config] Encryption error:", cryptoErr);
      return NextResponse.json(
        { error: "Error de configuración del servidor. Contacta al administrador." },
        { status: 500 }
      );
    }

    // Test connection before saving
    try {
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
          { error: "No se pudo conectar al servidor IMAP. Verifica los datos." },
          { status: 400 }
        );
      }
    } catch (imapErr) {
      console.error("[mail/config] IMAP test error:", imapErr);
      return NextResponse.json(
        { error: "No se pudo conectar al servidor IMAP. Verifica los datos." },
        { status: 400 }
      );
    }

    const { randomUUID } = await import("crypto");

    // Upsert config
    const config = await prisma.emailConfig.upsert({
      where: { userId: authResult.userId },
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
        userId: authResult.userId,
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
  } catch (err) {
    console.error("[mail/config] POST error:", err);
    return NextResponse.json(
      { error: "Error al guardar configuración. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
