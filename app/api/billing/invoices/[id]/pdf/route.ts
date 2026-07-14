import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePDFBuffer } from "@/lib/invoice-pdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            organization: true,
            members: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Check if the user is a member of the project or organization
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });
    const orgIds = userOrgs.map((o) => o.organizationId);

    const isProjectMember = invoice.project.members.some((m) => m.userId === authResult.userId);
    const isOrgMember = invoice.project.organizationId && orgIds.includes(invoice.project.organizationId);

    if (!isProjectMember && !isOrgMember) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const organization = invoice.project.organization;
    if (!organization) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    const pdfBuffer = await generateInvoicePDFBuffer(invoice, organization);

    // Return the PDF buffer directly with correct headers for download
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="factura-${invoice.id.substring(0, 8).toUpperCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation endpoint error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
