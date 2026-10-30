import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";
import { cuid } from "@/lib/utils";
import { jsPDF } from "jspdf";

function buildContractPdfBase64(deal: {
  id: string;
  title: string;
  value: number;
  expectedClose: Date | null;
  notes: string | null;
  createdAt: Date;
  contact: { name: string; email: string | null; company: string | null; phone: string | null } | null;
  organization: {
    name: string;
    billingName: string | null;
    billingTaxId: string | null;
    billingAddress: string | null;
    billingEmail: string | null;
  } | null;
}): string {
  const doc = new jsPDF();
  const orgName = deal.organization?.billingName || deal.organization?.name || "Agencia / Proveedor";
  const orgTax = deal.organization?.billingTaxId ? `NIF/CIF: ${deal.organization.billingTaxId}` : "";
  const orgAddr = deal.organization?.billingAddress || "";
  const clientName = deal.contact?.company || deal.contact?.name || "Cliente";
  const clientContact = deal.contact?.name || "";
  const clientEmail = deal.contact?.email || "";
  const dateStr = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedValue = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(deal.value || 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CONTRATO DE PRESTACIÓN DE SERVICIOS", 20, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 20, 35);
  doc.text(`Referencia: ${deal.id.slice(-8).toUpperCase()}`, 20, 41);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. PARTES CONTRATANTES", 20, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 63;
  doc.text(`PROVEEDOR: ${orgName}`, 20, y);
  y += 6;
  if (orgTax) {
    doc.text(orgTax, 20, y);
    y += 6;
  }
  if (orgAddr) {
    doc.text(`Dirección: ${orgAddr}`, 20, y);
    y += 6;
  }
  y += 4;
  doc.text(`CLIENTE: ${clientName}`, 20, y);
  y += 6;
  if (clientContact && clientContact !== clientName) {
    doc.text(`Representante: ${clientContact}`, 20, y);
    y += 6;
  }
  if (clientEmail) {
    doc.text(`Email: ${clientEmail}`, 20, y);
    y += 6;
  }

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("2. OBJETO DEL CONTRATO", 20, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subjectLines = doc.splitTextToSize(
    `El presente contrato tiene por objeto la prestación de los servicios correspondientes a "${deal.title}".`,
    170
  );
  doc.text(subjectLines, 20, y);
  y += subjectLines.length * 6 + 6;

  if (deal.notes) {
    const noteLines = doc.splitTextToSize(`Alcance / Notas: ${deal.notes}`, 170);
    doc.text(noteLines, 20, y);
    y += noteLines.length * 6 + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. CONDICIONES ECONÓMICAS", 20, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Importe acordado: ${formattedValue} (impuestos aplicables no incluidos).`, 20, y);
  y += 8;
  if (deal.expectedClose) {
    doc.text(
      `Fecha estimada de ejecución / cierre: ${new Date(deal.expectedClose).toLocaleDateString("es-ES")}`,
      20,
      y
    );
    y += 8;
  }

  y += 20;
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);
  y += 6;
  doc.text(`Por ${orgName}`, 20, y);
  doc.text(`Por ${clientName}`, 120, y);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId");
    if (!dealId) {
      return NextResponse.json({ error: "dealId es requerido" }, { status: 400 });
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        OR: [
          { ownerId: authResult.userId },
          { organizationId: { in: userOrgIds } },
        ],
      },
      include: {
        contact: { select: { name: true, email: true, company: true, phone: true } },
        pipeline: {
          include: {
            organization: {
              select: {
                name: true,
                billingName: true,
                billingTaxId: true,
                billingAddress: true,
                billingEmail: true,
              },
            },
          },
        },
        activities: {
          where: { title: { startsWith: "Contrato: " } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }

    if (deal.activities.length === 0) {
      return NextResponse.json([]);
    }

    const pdfBase64 = buildContractPdfBase64({
      id: deal.id,
      title: deal.title,
      value: deal.value,
      expectedClose: deal.expectedClose,
      notes: deal.notes,
      createdAt: deal.createdAt,
      contact: deal.contact,
      organization: deal.pipeline?.organization || null,
    });

    const contracts = deal.activities.map((act) => ({
      id: act.id,
      fileName: act.title.replace(/^Contrato:\s*/, ""),
      status: "GENERATED",
      createdAt: act.createdAt.toISOString(),
      pdfUrl: `data:application/pdf;base64,${pdfBase64}`,
    }));

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Get contracts error:", error);
    return NextResponse.json({ error: "Error al obtener contratos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { dealId } = await request.json();
    if (!dealId || typeof dealId !== "string") {
      return NextResponse.json({ error: "dealId es requerido" }, { status: 400 });
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        OR: [
          { ownerId: authResult.userId },
          { organizationId: { in: userOrgIds } },
        ],
      },
      include: {
        contact: { select: { id: true, name: true, email: true, company: true, phone: true } },
        pipeline: {
          include: {
            organization: {
              select: {
                name: true,
                billingName: true,
                billingTaxId: true,
                billingAddress: true,
                billingEmail: true,
              },
            },
          },
        },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }

    const safeTitle = deal.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "deal";
    const fileName = `contrato-${safeTitle}.pdf`;

    const pdfBase64 = buildContractPdfBase64({
      id: deal.id,
      title: deal.title,
      value: deal.value,
      expectedClose: deal.expectedClose,
      notes: deal.notes,
      createdAt: deal.createdAt,
      contact: deal.contact,
      organization: deal.pipeline?.organization || null,
    });

    let contractId = cuid();
    const now = new Date();

    if (deal.contact?.id) {
      const activity = await prisma.activity.create({
        data: {
          id: contractId,
          type: "NOTE",
          title: `Contrato: ${fileName}`,
          description: `Contrato comercial generado por valor de ${deal.value} EUR`,
          contactId: deal.contact.id,
          dealId: deal.id,
          ownerId: authResult.userId,
          organizationId: deal.organizationId,
          completed: true,
          completedAt: now,
        },
      });
      contractId = activity.id;
    }

    return NextResponse.json(
      {
        id: contractId,
        fileName,
        status: "GENERATED",
        createdAt: now.toISOString(),
        pdfUrl: `data:application/pdf;base64,${pdfBase64}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Generate contract error:", error);
    return NextResponse.json({ error: "Error al generar contrato" }, { status: 500 });
  }
}
