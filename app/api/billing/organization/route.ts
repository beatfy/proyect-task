import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId: authResult.userId },
      select: {
        organization: true,
      },
      orderBy: { joinedAt: "asc" },
    });

    if (!member) {
      return NextResponse.json({ error: "Sin organización" }, { status: 404 });
    }

    return NextResponse.json(member.organization);
  } catch (error) {
    console.error("Get organization billing error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId: authResult.userId },
      orderBy: { joinedAt: "asc" },
    });

    if (!member) {
      return NextResponse.json({ error: "Sin organización" }, { status: 404 });
    }

    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.billingName !== undefined) updateData.billingName = body.billingName || null;
    if (body.billingTaxId !== undefined) updateData.billingTaxId = body.billingTaxId || null;
    if (body.billingAddress !== undefined) updateData.billingAddress = body.billingAddress || null;
    if (body.billingPhone !== undefined) updateData.billingPhone = body.billingPhone || null;
    if (body.billingEmail !== undefined) updateData.billingEmail = body.billingEmail || null;
    if (body.defaultIva !== undefined) updateData.defaultIva = parseFloat(body.defaultIva);
    if (body.defaultIrpf !== undefined) updateData.defaultIrpf = parseFloat(body.defaultIrpf);
    if (body.invoiceTemplate !== undefined) updateData.invoiceTemplate = body.invoiceTemplate;
    if (body.logo !== undefined) updateData.logo = body.logo || null;
    if (body.billingFooter !== undefined) updateData.billingFooter = body.billingFooter || null;

    const updated = await prisma.organization.update({
      where: { id: member.organizationId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update organization billing error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
