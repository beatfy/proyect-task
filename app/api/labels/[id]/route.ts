import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { verifyOrgMembership } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const labelUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }

    if (existing.organizationId) {
      const { valid: isMember } = await verifyOrgMembership(authResult.userId, existing.organizationId);
      if (!isMember) {
        return NextResponse.json({ error: "Sin acceso a esta etiqueta" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = labelUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const label = await prisma.label.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(label);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }
    console.error("Update label error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }

    if (existing.organizationId) {
      const { valid: isMember } = await verifyOrgMembership(authResult.userId, existing.organizationId);
      if (!isMember) {
        return NextResponse.json({ error: "Sin acceso a esta etiqueta" }, { status: 403 });
      }
    }

    await prisma.label.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Etiqueta no encontrada" }, { status: 404 });
    }
    console.error("Delete label error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
