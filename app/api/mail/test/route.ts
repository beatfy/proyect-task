import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

// POST /api/mail/test - Test IMAP connection
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
    if (!authResult) {
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

    const { testConnection } = await import("@/lib/imap");
    const result = await testConnection({
      host,
      port: port || 993,
      email,
      password,
      ssl: ssl !== false,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[mail/test] Error:", err);
    return NextResponse.json(
      { success: false, error: "No se pudo conectar al servidor IMAP. Verifica los datos." },
      { status: 500 }
    );
  }
}
