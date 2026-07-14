function hexToRgb(hex: string): [number, number, number] {
  const defaultColor: [number, number, number] = [99, 102, 241]; // #6366f1
  if (!hex) return defaultColor;
  
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  
  if (clean.length !== 6) return defaultColor;
  
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  
  return [r, g, b];
}

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

  // Colors & Brand Theme
  const brandColor = hexToRgb(invoice.project?.color || "#6366f1");
  const darkColor = [15, 23, 42]; // #0f172a
  const lightGray = [100, 116, 139]; // #64748b

  let companyTextX = 20;
  let currentY = 25;

  // 1. Header (Logo & Company Details)
  if (organization.logo) {
    try {
      const format = organization.logo.split(";")[0].split("/")[1]?.toUpperCase() || "PNG";
      doc.addImage(organization.logo, format, 20, 18, 25, 25);
      companyTextX = 50; // Shift right
      currentY = 22;
    } catch (err) {
      console.error("Error inserting logo into invoice PDF:", err);
    }
  }

  // Draw organization name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
  
  const orgName = organization.billingName || organization.name || "Mi Empresa";
  doc.text(orgName, companyTextX, currentY);
  
  // Draw company details
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  
  let companyInfo = "";
  if (organization.billingTaxId) companyInfo += `NIF/CIF: ${organization.billingTaxId}\n`;
  if (organization.billingAddress) companyInfo += `Dir: ${organization.billingAddress}\n`;
  if (organization.billingEmail) companyInfo += `Email: ${organization.billingEmail}\n`;
  if (organization.billingPhone) companyInfo += `Tel: ${organization.billingPhone}`;
  
  const infoLines = companyInfo.trim().split("\n");
  infoLines.forEach((line, idx) => {
    doc.text(line, companyTextX, currentY + 5.5 + (idx * 4));
  });

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
  
  const clientName = invoice.project?.name || "Cliente";
  let clientDetails = `${clientName}\n`;
  if (invoice.project?.clientEmail) {
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

  const conceptText = invoice.concept || invoice.project?.billingConcept || "Servicios prestados";

  const tableData = [
    [
      `${conceptText} - ${monthNames[invoice.month - 1]} ${invoice.year}`,
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
      fillColor: brandColor,
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

  // 5. Footer (Support custom text & bank info)
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  
  const footerText = organization.billingFooter || "Gracias por su confianza.";
  const footerLines = doc.splitTextToSize(footerText, 170);
  doc.text(footerLines, 20, 265);

  // Return buffer
  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}
