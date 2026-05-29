import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", "/reports");
    return NextResponse.redirect(loginUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");

  if (error) {
    const reportsUrl = new URL("/reports", request.url);
    reportsUrl.searchParams.set("meta_error", errorReason || error);
    return NextResponse.redirect(reportsUrl);
  }

  if (!code) {
    const reportsUrl = new URL("/reports", request.url);
    reportsUrl.searchParams.set("meta_error", "no_code");
    return NextResponse.redirect(reportsUrl);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("META_APP_ID or META_APP_SECRET not configured");
    const reportsUrl = new URL("/reports", request.url);
    reportsUrl.searchParams.set("meta_error", "server_config");
    return NextResponse.redirect(reportsUrl);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;

    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`,
      { method: "GET" }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Meta token exchange error:", tokenData.error);
      const reportsUrl = new URL("/reports", request.url);
      reportsUrl.searchParams.set("meta_error", "token_exchange");
      return NextResponse.redirect(reportsUrl);
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    let expiresAt: Date | null = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    const meRes = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
    );
    const meData = await meRes.json();

    let adAccountId: string | null = null;
    let adAccountName: string | null = null;

    try {
      const accountsRes = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${accessToken}`
      );
      const accountsData = await accountsRes.json();

      if (accountsData.data && accountsData.data.length > 0) {
        adAccountId = accountsData.data[0].id;
        adAccountName = accountsData.data[0].name;
      }
    } catch (e) {
      console.error("Error fetching ad accounts:", e);
    }

    const longLivedTokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${accessToken}`
    );
    const longLivedData = await longLivedTokenRes.json();

    const finalToken = longLivedData.access_token || accessToken;
    const finalExpiresIn = longLivedData.expires_in || expiresIn;

    if (finalExpiresIn) {
      expiresAt = new Date(Date.now() + finalExpiresIn * 1000);
    }

    await prisma.metaConnection.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: finalToken,
        refreshToken: null,
        expiresAt,
        adAccountId,
        adAccountName,
        status: "CONNECTED",
      },
      update: {
        accessToken: finalToken,
        refreshToken: null,
        expiresAt,
        adAccountId,
        adAccountName,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
    });

    const reportsUrl = new URL("/reports", request.url);
    reportsUrl.searchParams.set("meta_connected", "true");
    return NextResponse.redirect(reportsUrl);
  } catch (error) {
    console.error("Meta OAuth callback error:", error);
    const reportsUrl = new URL("/reports", request.url);
    reportsUrl.searchParams.set("meta_error", "unknown");
    return NextResponse.redirect(reportsUrl);
  }
}
