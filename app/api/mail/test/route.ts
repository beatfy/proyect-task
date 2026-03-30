import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testConnection } from "@/lib/imap";

// POST /api/mail/test - Test IMAP connection
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

    const result = await testConnection({
      host,
      port: port || 993,
      email,
      password,
      ssl: ssl !== false,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al probar conexión" },
      { status: 500 }
    );
  }
}
