import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET - Obtener estado de conexión y métricas
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const connection = await prisma.googleAnalyticsConnection.findUnique({
      where: { userId: authResult.userId },
    });

    if (!connection) {
      return NextResponse.json({ 
        connected: false,
        message: "No conectado a Google Analytics"
      });
    }

    if (connection.expiresAt && connection.expiresAt < new Date()) {
      return NextResponse.json({ 
        connected: false,
        message: "Token expirado, reconecta"
      });
    }

    if (action === "status") {
      return NextResponse.json({
        connected: true,
        propertyName: connection.propertyName,
        propertyId: connection.propertyId,
      });
    }

    // Obtener métricas de Google Analytics
    const metrics = await fetchGA4Metrics(connection.accessToken, connection.propertyId);

    return NextResponse.json({
      connected: true,
      propertyName: connection.propertyName,
      metrics,
    });
  } catch (error) {
    console.error("GA integration error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST - Guardar token de acceso
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { accessToken, propertyId, propertyName } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    // Validar token con Google
    const isValid = await validateGAToken(accessToken);
    if (!isValid) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    await prisma.googleAnalyticsConnection.upsert({
      where: { userId: authResult.userId },
      create: {
        userId: authResult.userId,
        accessToken,
        propertyId: propertyId || null,
        propertyName: propertyName || null,
        status: "CONNECTED",
      },
      update: {
        accessToken,
        propertyId: propertyId || null,
        propertyName: propertyName || null,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Conectado a Google Analytics" });
  } catch (error) {
    console.error("GA connect error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE - Desconectar
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await prisma.googleAnalyticsConnection.deleteMany({
      where: { userId: authResult.userId },
    });

    return NextResponse.json({ success: true, message: "Desconectado de Google Analytics" });
  } catch (error) {
    console.error("GA disconnect error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Helper: Validar token con Google
async function validateGAToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Helper: Obtener métricas de GA4
async function fetchGA4Metrics(token: string, propertyId?: string | null) {
  try {
    if (!propertyId) {
      return { error: "No hay property configurada" };
    }

    // GA4 runReport API
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    
    const body = {
      dateRanges: [
        {
          startDate: "30daysAgo",
          endDate: "today",
        },
      ],
      dimensions: [
        { name: "date" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      return { error: err.error?.message || "Error fetching GA metrics" };
    }

    const data = await res.json();

    // Calcular totales
    const totals = data.rows?.reduce((acc: any, row: any) => {
      const metrics = row.metricValues;
      return {
        sessions: (acc.sessions || 0) + parseInt(metrics[0]?.value || 0),
        activeUsers: (acc.activeUsers || 0) + parseInt(metrics[1]?.value || 0),
        pageViews: (acc.pageViews || 0) + parseInt(metrics[2]?.value || 0),
      };
    }, {});

    return {
      rows: data.rows?.length || 0,
      totals: totals || { sessions: 0, activeUsers: 0, pageViews: 0 },
      period: "30 días",
    };
  } catch (error) {
    console.error("Fetch GA metrics error:", error);
    return { error: "Error obteniendo métricas de Analytics" };
  }
}
