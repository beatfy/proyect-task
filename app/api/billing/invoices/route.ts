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
    const month = searchParams.get("month");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);

    // Find all organizations user is member of
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    // Only invoices for projects the user is member of OR which belong to user's orgs
    where.project = {
      OR: [
        { members: { some: { userId: authResult.userId } } },
        { organizationId: { in: orgIds } },
      ],
    };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
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
    const { projectId, amount, notes, concept, makeRecurring, clientEmail, billingDay } = body;

    // Auto-calculate previous month + dueDate = today + 7 days
    const now = new Date();
    let month = now.getMonth(); // 0-indexed → previous month
    let year = now.getFullYear();
    if (month === 0) { month = 12; year--; }
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Allow explicit overrides from body
    if (body.month) month = parseInt(body.month);
    if (body.year) year = parseInt(body.year);
    const finalDueDate = body.dueDate ? new Date(body.dueDate) : dueDate;

    if (!projectId || !amount) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Verify permission (project OWNER/ADMIN OR organization OWNER/ADMIN)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    let isPrivileged = false;
    if (project) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
      });
      if (member) {
        isPrivileged = true;
      } else if (project.organizationId) {
        const orgMember = await prisma.organizationMember.findFirst({
          where: {
            userId: authResult.userId,
            organizationId: project.organizationId,
            role: { in: ["OWNER", "ADMIN"] },
          },
        });
        if (orgMember) isPrivileged = true;
      }
    }

    if (!isPrivileged) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        id: cuid(),
        projectId,
        month,
        year,
        amount: parseFloat(amount),
        dueDate: finalDueDate,
        notes: notes || null,
        concept: concept || null,
      },
    });

    if (makeRecurring) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          monthlyFee: parseFloat(amount),
          clientEmail: clientEmail || null,
          recurringInvoice: true,
          billingDay: billingDay ? parseInt(billingDay) : 31,
          billingConcept: concept || null,
          invoiceEmailMsg: `Adjuntamos la factura mensual correspondiente al servicio de ${concept || "desarrollo"}.`,
        },
      });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Create invoice error:", error);
    if ((error as any)?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una factura para ese proyecto/mes/año" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Fetch invoices to verify permissions
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids } },
      include: { project: { include: { members: true } } },
    });

    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: authResult.userId, role: { in: ["OWNER", "ADMIN"] } },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    const unauthorized = invoices.some((invoice) => {
      const isProjectPrivileged = invoice.project.members.some(
        (m) => m.userId === authResult.userId && ["OWNER", "ADMIN"].includes(m.role)
      );
      const isOrgPrivileged = invoice.project.organizationId && orgIds.includes(invoice.project.organizationId);
      return !isProjectPrivileged && !isOrgPrivileged;
    });

    if (unauthorized) {
      return NextResponse.json({ error: "Sin permisos para una o más facturas" }, { status: 403 });
    }

    if (action === "status" && body.status) {
      const updateData: Record<string, unknown> = { status: body.status };
      if (body.status === "PAID") {
        updateData.paidAt = new Date();
      } else {
        updateData.paidAt = null;
      }
      await prisma.invoice.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });
      return NextResponse.json({ success: true, count: invoices.length });
    } else if (action === "delete") {
      await prisma.invoice.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ success: true, count: invoices.length });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Bulk invoice error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
