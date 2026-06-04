import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "uploads", "agent-documents");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const doc = await prisma.agentDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const urlMatch = doc.url.match(/\/api\/agents\/documents\/(.+)/);
    const filename = urlMatch ? urlMatch[1] : id;
    const localPath = join(UPLOAD_DIR, filename);

    if (!existsSync(localPath)) {
      return NextResponse.json({ error: "El archivo físico no existe" }, { status: 404 });
    }

    const fileBuffer = await readFile(localPath);
    const ext = doc.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      txt: 'text/plain',
      csv: 'text/csv',
      md: 'text/markdown',
      json: 'application/json',
    };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(doc.name)}"`);
    headers.set("Content-Length", String(fileBuffer.length));
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error) {
    console.error("Download agent document error:", error);
    return NextResponse.json({ error: "Error al descargar el archivo" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const doc = await prisma.agentDocument.findFirst({
      where: { id, userId: authResult.userId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Documento no encontrado o no autorizado" }, { status: 404 });
    }

    const urlMatch = doc.url.match(/\/api\/agents\/documents\/(.+)/);
    if (urlMatch) {
      const localPath = join(UPLOAD_DIR, urlMatch[1]);
      await unlink(localPath).catch(() => {});
    }

    await prisma.agentDocument.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete agent document error:", error);
    return NextResponse.json({ error: "Error al eliminar el documento" }, { status: 500 });
  }
}
