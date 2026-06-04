import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { cuid } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import * as XLSX from "xlsx";

const UPLOAD_DIR = process.env.VERCEL
  ? join("/tmp", "agent-documents")
  : join(process.cwd(), "uploads", "agent-documents");

const ALLOWED_EXTENSIONS = ["txt", "csv", "md", "json", "pdf", "xlsx", "xls"];

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "")
    .substring(0, 100);
}

async function extractText(buffer: Buffer, extension: string): Promise<string> {
  if (extension === "pdf") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf = require("pdf-parse");
      const parsed = await pdf(buffer);
      return parsed.text || "";
    } catch (err) {
      console.error("Error al cargar o ejecutar pdf-parse:", err);
      throw new Error("Librería de lectura de PDF (pdf-parse) no disponible o fallida en este servidor. Contacta al administrador o sube archivos de texto/Excel.");
    }
  } else if (extension === "xlsx" || extension === "xls") {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let text = "";
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += `[Pestaña: ${sheetName}]\n`;
        text += XLSX.utils.sheet_to_txt(sheet) + "\n\n";
      });
      return text;
    } catch (err) {
      console.error("Error extrayendo texto de Excel:", err);
      throw new Error("Error al leer el archivo Excel.");
    }
  } else {
    // Archivo de texto plano (txt, csv, md, json)
    try {
      return buffer.toString("utf-8");
    } catch (err) {
      console.error("Error leyendo archivo de texto:", err);
      throw new Error("Error al leer el archivo de texto.");
    }
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: authResult.userId };
    if (agentId) {
      where.agentId = agentId;
    }

    const documents = await prisma.agentDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        url: true,
        type: true,
        size: true,
        createdAt: true,
        agentId: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET agent documents error:", error);
    return NextResponse.json({ error: "Error al obtener documentos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const agentId = formData.get("agentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Se requiere un archivo" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Tipo de archivo no permitido (.${ext}). Tipos permitidos: PDF, Excel (XLSX, XLS), TXT, CSV, MD, JSON`,
        },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo supera el límite permitido de 10MB` },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(file.name);
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Asegurar directorio
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = join(UPLOAD_DIR, uniqueName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Extraer texto
    let extractedText = "";
    try {
      extractedText = await extractText(buffer, ext);
    } catch (extractErr: any) {
      return NextResponse.json({ error: extractErr.message || "Error al procesar el texto del archivo" }, { status: 400 });
    }

    // Determinar tipo general
    let fileType = "document";
    if (ext === "pdf") fileType = "pdf";
    else if (ext === "xlsx" || ext === "xls") fileType = "excel";

    const doc = await prisma.agentDocument.create({
      data: {
        id: cuid(),
        name: safeName,
        url: `/api/agents/documents/${uniqueName}`,
        type: fileType,
        size: file.size,
        text: extractedText,
        userId: authResult.userId,
        agentId: agentId || null,
      },
    });

    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      url: doc.url,
      type: doc.type,
      size: doc.size,
      createdAt: doc.createdAt,
      textLength: doc.text?.length || 0,
    });
  } catch (error) {
    console.error("POST agent documents error:", error);
    return NextResponse.json({ error: "Error al procesar y guardar el archivo" }, { status: 500 });
  }
}
