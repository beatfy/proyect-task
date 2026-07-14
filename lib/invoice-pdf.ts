import { prisma } from "@/lib/prisma";

export async function generateInvoicePDFBuffer(invoice: any, organization: any): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Colors
  const primaryColor = [99, 102, 241]; // #6366f1
  const darkColor = [15, 23, 42]; // #0f172a
  const lightGray = [100, 116, 139]; // #64748b

  // 1. Header (Logo / Title)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  const orgName = organization.billingName || organization.name || "Mi Empresa";
  doc.text(orgName, 20, 25);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  
  let companyInfo = "";
  if (organization.billingTaxId) companyInfo += `NIF/CIF: ${organization.billingTaxId}\n`;
  if (organization.billingAddress) companyInfo += `Dir: ${organization.billingAddress}\n`;
  if (organization.billingEmail) companyInfo += `Email: ${organization.billingEmail}\n`;
  if (organization.billingPhone) companyInfo += `Tel: ${organization.billingPhone}`;
  doc.text(companyInfo.trim(), 20, 32);

  // Invoice Details Box (Right top)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("FACTURA", 140, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  
  const invDate = new Date(invoice.createdAt);
  const dueDate = new Date(invoice.dueDate);
  
  let detailsText = `Factura Nº: ${invoice.id.substring(0, 8).toUpperCase()}\n`;
  detailsText += `Fecha Emisión: ${invDate.toLocaleDateString("es-ES")}\n`;
  detailsText += `Fecha Vence: ${dueDate.toLocaleDateString("es-ES")}`;
  doc.text(detailsText, 140, 32);

  // Divider line
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.5);
  doc.line(20, 52, 190, 52);

  // 2. Billing details (De / Para)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text("DATOS CLIENTE", 20, 62);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  
  const clientName = invoice.project.name;
  let clientDetails = `${clientName}\n`;
  if (invoice.project.clientEmail) {
    clientDetails += `Email: ${invoice.project.clientEmail}\n`;
  }
  if (invoice.notes) {
    clientDetails += `Notas adicionales: ${invoice.notes}`;
  }
  doc.text(clientDetails.trim(), 20, 68);

  // 3. Line Items Table
  const base = invoice.amount;
  const ivaRate = organization.defaultIva ?? 21;
  const irpfRate = organization.defaultIrpf ?? 15;

  const iva = base * (ivaRate / 100);
  const irpf = base * (irpfRate / 100);
  const total = base + iva - irpf;

  const tableData = [
    [
      `Servicios de desarrollo mensual - ${monthNames[invoice.month - 1]} ${invoice.year}`,
      base.toLocaleString("es-ES", { style: "currency", currency: "EUR" }),
      `${ivaRate}%`,
      `${irpfRate}%`,
      total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
    ]
  ];

  autoTable(doc, {
    startY: 85,
    margin: { left: 20, right: 20 },
    head: [["Concepto", "Base Imponible", "IVA", "IRPF", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 25, halign: "right" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Totals Block (Align right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  doc.text("Base Imponible:", 120, finalY);
  doc.text(base.toLocaleString("es-ES", { style: "currency", currency: "EUR" }), 190, finalY, { align: "right" });

  doc.text(`IVA (${ivaRate}%):`, 120, finalY + 6);
  doc.text(`+${iva.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`, 190, finalY + 6, { align: "right" });

  doc.text(`IRPF (-${irpfRate}%):`, 120, finalY + 12);
  doc.text(`-${irpf.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`, 190, finalY + 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total Neto a Pagar:", 120, finalY + 20);
  doc.text(total.toLocaleString("es-ES", { style: "currency", currency: "EUR" }), 190, finalY + 20, { align: "right" });

  // 5. Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text("Gracias por su confianza.", 20, 270);

  // Return buffer
  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}
