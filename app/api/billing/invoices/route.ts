import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (year) where.year = parseInt(year);

    // Only invoices for projects the user is member of
    where.project = { members: { some: { userId: authResult.userId } } };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, month, year, amount, dueDate, notes } = body;

    if (!projectId || !month || !year || !amount || !dueDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Verify membership
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (!member) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: cuid(),
        projectId,
        month: parseInt(month),
        year: parseInt(year),
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        notes: notes || null,
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Create invoice error:", error);
    if ((error as any)?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una factura para ese proyecto/mes/año" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
