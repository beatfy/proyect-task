import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { verifyOrgMembership } from "@/lib/tenant";
import * as XLSX from "xlsx";

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "nombre", "full_name", "fullname", "nombre_completo", "contact", "contacto", "contact_name"],
  email: ["email", "e-mail", "correo", "correo_electronico", "mail", "email_address"],
  phone: ["phone", "telefono", "tel", "teléfono", "phone_number", "movil", "móvil", "cell", "mobile"],
  company: ["company", "empresa", "compañia", "compañía", "organizacion", "organization", "company_name", "empresa_nombre"],
  notes: ["notes", "notas", "nota", "note", "description", "descripcion", "descripción", "comments", "observaciones"],
  tags: ["tags", "etiquetas", "tag", "etiqueta", "labels", "label"],
  status: ["status", "estado", "state"],
};

const VALID_STATUSES = ["LEAD", "CONTACTED", "QUALIFIED", "CUSTOMER"];

function detectFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[\s_-]+/g, "_"));

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  return mapping;
}

function getCellValue(row: Record<string, unknown>, header: string): string {
  const val = row[header];
  if (val == null) return "";
  return String(val).trim();
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organizationId") as string | null;
    const defaultStatus = (formData.get("defaultStatus") as string) || "LEAD";
    const skipDuplicates = formData.get("skipDuplicates") === "true";

    if (!file) {
      return NextResponse.json({ error: "No se ha proporcionado archivo" }, { status: 400 });
    }

    let orgId: string | null = null;
    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      orgId = organizationId;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.toLowerCase();

    let workbook: XLSX.WorkBook;
    try {
      if (filename.endsWith(".csv")) {
        workbook = XLSX.read(buffer, { type: "buffer", raw: false, codepage: 65001 });
      } else {
        workbook = XLSX.read(buffer, { type: "buffer" });
      }
    } catch {
      return NextResponse.json({ error: "No se pudo leer el archivo. Verifica el formato." }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene datos válidos" }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    const fieldMapping = detectFieldMapping(headers);

    if (!fieldMapping.name) {
      return NextResponse.json({
        error: "No se encontró columna de nombre. Asegúrate de que el archivo tiene una columna llamada 'name', 'nombre' o 'Nombre completo'",
        detectedColumns: headers,
      }, { status: 400 });
    }

    let existingEmails: Set<string> = new Set();
    if (skipDuplicates && orgId) {
      const existing = await prisma.contact.findMany({
        where: { organizationId: orgId, email: { not: null } },
        select: { email: true },
      });
      existingEmails = new Set(existing.map(c => c.email!.toLowerCase()));
    }

    const BATCH_SIZE = 100;
    let imported = 0;
    let skipped = 0;
    const errors: { row: number; name: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const contactsToCreate: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
        notes: string | null;
        tags: string[];
        status: string;
        ownerId: string;
        organizationId: string | null;
      }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNum = i + j + 2;
        const name = getCellValue(row, fieldMapping.name);

        if (!name) {
          errors.push({ row: rowNum, name: "(vacío)", error: "Nombre vacío" });
          continue;
        }

        const email = fieldMapping.email ? getCellValue(row, fieldMapping.email) : "";
        const phone = fieldMapping.phone ? getCellValue(row, fieldMapping.phone) : "";
        const company = fieldMapping.company ? getCellValue(row, fieldMapping.company) : "";
        const notes = fieldMapping.notes ? getCellValue(row, fieldMapping.notes) : "";
        const tagsRaw = fieldMapping.tags ? getCellValue(row, fieldMapping.tags) : "";
        const statusRaw = fieldMapping.status ? getCellValue(row, fieldMapping.status).toUpperCase() : "";

        let status = VALID_STATUSES.includes(statusRaw) ? statusRaw : defaultStatus;

        if (skipDuplicates && email && existingEmails.has(email.toLowerCase())) {
          skipped++;
          continue;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ row: rowNum, name, error: `Email inválido: ${email}` });
          continue;
        }

        contactsToCreate.push({
          id: cuid(),
          name,
          email: email || null,
          phone: phone || null,
          company: company || null,
          notes: notes || null,
          tags: tagsRaw ? tagsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [],
          status,
          ownerId: authResult.userId,
          organizationId: orgId,
        });
      }

      if (contactsToCreate.length > 0) {
        try {
          await prisma.contact.createMany({ data: contactsToCreate, skipDuplicates: true });
          imported += contactsToCreate.length;
        } catch (batchError) {
          for (const contact of contactsToCreate) {
            try {
              await prisma.contact.create({ data: contact });
              imported++;
            } catch {
              errors.push({
                row: -1,
                name: contact.name,
                error: `Error al crear: ${batchError instanceof Error ? batchError.message : "desconocido"}`,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 50),
      totalRows: rows.length,
      fieldMapping,
      sheetName,
    });
  } catch (error) {
    console.error("Import contacts error:", error);
    return NextResponse.json({ error: "Error interno durante la importación" }, { status: 500 });
  }
}
