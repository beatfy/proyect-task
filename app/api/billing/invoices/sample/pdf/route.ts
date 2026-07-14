import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePDFBuffer } from "@/lib/invoice-pdf";

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

    if (!member || !member.organization) {
      return NextResponse.json({ error: "Sin organización" }, { status: 404 });
    }

    const mockInvoice = {
      id: "sample-123",
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      amount: 450,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      project: {
        name: "Cliente de Prueba S.A.",
        clientEmail: "facturas@clienteprueba.com",
      },
      notes: "Esta es una factura de muestra generada para visualizar el diseño y los datos de su plantilla.",
    };

    const pdfBuffer = await generateInvoicePDFBuffer(mockInvoice, member.organization);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="factura-ejemplo.pdf"',
      },
    });
  } catch (error) {
    console.error("PDF sample route error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
