import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const connection = await prisma.metaConnection.findUnique({
      where: { userId: authResult.userId },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
        message: "No conectado a Meta Ads",
      });
    }

    if (action === "status") {
      return NextResponse.json({
        connected: true,
        adAccountName: connection.adAccountName,
        adAccountId: connection.adAccountId,
      });
    }

    let accessToken = connection.accessToken;

    if (connection.expiresAt && connection.expiresAt < new Date()) {
      const refreshed = await refreshMetaToken(accessToken);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        await prisma.metaConnection.update({
          where: { userId: authResult.userId },
          data: {
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
            updatedAt: new Date(),
          },
        });
      } else {
        return NextResponse.json({
          connected: false,
          message: "Token expirado, reconecta tu cuenta",
        });
      }
    }

    const metrics = await fetchMetaMetrics(accessToken, connection.adAccountId);

    return NextResponse.json({
      connected: true,
      adAccountName: connection.adAccountName,
      metrics,
    });
  } catch (error) {
    console.error("Meta integration error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { accessToken, adAccountId, adAccountName } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const isValid = await validateMetaToken(accessToken);
    if (!isValid) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    await prisma.metaConnection.upsert({
      where: { userId: authResult.userId },
      create: {
        userId: authResult.userId,
        accessToken,
        adAccountId: adAccountId || null,
        adAccountName: adAccountName || null,
        status: "CONNECTED",
      },
      update: {
        accessToken,
        adAccountId: adAccountId || null,
        adAccountName: adAccountName || null,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Conectado a Meta Ads" });
  } catch (error) {
    console.error("Meta connect error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await prisma.metaConnection.deleteMany({
      where: { userId: authResult.userId },
    });

    return NextResponse.json({ success: true, message: "Desconectado de Meta Ads" });
  } catch (error) {
    console.error("Meta disconnect error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

async function validateMetaToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${token}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function refreshMetaToken(currentToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
} | null> {
  try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return null;

    const res = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${currentToken}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.access_token) return null;

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 3600 * 1000);

    return { accessToken: data.access_token, expiresAt };
  } catch {
    return null;
  }
}

async function fetchMetaMetrics(token: string, adAccountId?: string | null) {
  try {
    if (!adAccountId) {
      return { error: "No hay cuenta publicitaria configurada" };
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const until = new Date();

    const insightsUrl =
      `https://graph.facebook.com/v18.0/${adAccountId}/insights?` +
      `fields=spend,impressions,clicks,ctr,cpc&` +
      `time_range={'since':'${since.toISOString().split("T")[0]}','until':'${until.toISOString().split("T")[0]}'}&` +
      `access_token=${token}`;

    const res = await fetch(insightsUrl);
    if (!res.ok) {
      const err = await res.json();
      return { error: err.error?.message || "Error fetching metrics" };
    }

    const data = await res.json();

    const totals = data.data?.reduce(
      (acc: any, item: any) => ({
        spend: (acc.spend || 0) + parseFloat(item.spend || 0),
        impressions: (acc.impressions || 0) + parseInt(item.impressions || 0),
        clicks: (acc.clicks || 0) + parseInt(item.clicks || 0),
      }),
      {}
    );

    return {
      campaigns: data.data?.length || 0,
      totals: totals || { spend: 0, impressions: 0, clicks: 0 },
      period: "30 días",
    };
  } catch (error) {
    console.error("Fetch Meta metrics error:", error);
    return { error: "Error obteniendo métricas" };
  }
}
