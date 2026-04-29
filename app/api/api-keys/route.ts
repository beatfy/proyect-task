import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, permissions: true, lastUsedAt: true, createdAt: true, active: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(keys);
  } catch (error) {
    console.error("List API keys error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    // Generate key with tx2_ prefix
    const rawKey = `tx2_${crypto.randomBytes(32).toString("hex")}`;
    const hashedKey = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        id: cuid(),
        key: hashedKey,
        keyPrefix,
        name,
        userId: session.user.id,
        permissions: permissions || "full",
      },
    });

    // Return plaintext key ONLY on creation
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
