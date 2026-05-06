import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import jsPDF from "jspdf";

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { dealId, artistName, terms } = body;

    if (!dealId) {
      return NextResponse.json({ error: "dealId es requerido" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contact: true,
        stage: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Bolo no encontrado" }, { status: 404 });
    }

    const artist = artistName || "ARTISTA";
    const venue = deal.contact.name || "SALA/PROMOTOR";
    const eventDate = deal.expectedClose
      ? new Date(deal.expectedClose).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "POR CONFIRMAR";
    const fee = deal.value || 0;
    const currency = "EUR";

    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("CONTRATO DE ACTUACION", 105, 30, { align: "center" });

    doc.setFontSize(11);
    let y = 55;
    const addLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 80, y);
      y += 10;
    };

    addLine("Artista / DJ:", artist);
    addLine("Sala / Promotor:", venue);
    addLine("Fecha del evento:", eventDate);
    addLine("Caché:", `${fee.toLocaleString("es-ES", { style: "currency", currency })}`);
    addLine("Contacto:", deal.contact.email || deal.contact.phone || "—");

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("CONDICIONES:", 20, y);
    y += 10;
    doc.setFont("helvetica", "normal");

    const contractTerms = terms || `1. El artista se compromete a realizar una actuación de DJ en ${venue} el día ${eventDate}.\n2. El caché acordado es de ${fee.toLocaleString("es-ES", { style: "currency", currency })}, pagadero el día del evento o según acuerdo previo.\n3. La sala se compromete a proporcionar el equipo técnico según el rider del artista.\n4. Cancelaciones con menos de 72h de antelación: el artista retiene el 50% del caché.\n5. El artista retiene todos los derechos de imagen y grabación de su actuación.`;

    const lines = doc.splitTextToSize(contractTerms, 170);
    doc.text(lines, 20, y);

    y = 240;
    doc.line(20, y, 90, y);
    doc.text("Firma del Artista", 20, y + 8);
    doc.line(120, y, 190, y);
    doc.text("Firma del Promotor", 120, y + 8);

    const pdfBase64 = doc.output("datauristring").split(",")[1];

    const contract = await prisma.smartContract.create({
      data: {
        id: cuid(),
        dealId: deal.id,
        pdfUrl: `data:application/pdf;base64,${pdfBase64}`,
        fileName: `contrato_${artist.replace(/\s+/g, "_")}_${venue.replace(/\s+/g, "_")}.pdf`,
        venueName: venue,
        artistName: artist,
        eventDate: deal.expectedClose || new Date(),
        fee,
        currency,
        terms: contractTerms,
        status: "GENERATED",
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Smart contract error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId");

    const where = dealId ? { dealId } : {};
    const contracts = await prisma.smartContract.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Get contracts error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
