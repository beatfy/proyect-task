import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "uploads", "task-attachments");

// GET /api/attachments/[id] — stream a local attachment (verifies auth)
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
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    // Try local file first
    // URL format: /api/attachments/{taskId}/{uniqueName}
    const urlMatch = attachment.url.match(/\/api\/attachments\/(.+)/);
    if (urlMatch) {
      const localPath = join(UPLOAD_DIR, urlMatch[1]);
      if (existsSync(localPath)) {
        const fileBuffer = await readFile(localPath);
        const ext = attachment.name.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
          txt: 'text/plain',
        };
        const contentType = mimeMap[ext || ''] || 'application/octet-stream';

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.name)}"`);
        headers.set("Content-Length", String(fileBuffer.length));
        headers.set("Cache-Control", "private, max-age=300");

        return new NextResponse(fileBuffer, { status: 200, headers });
      }
    }

    // Fallback: if URL looks like a remote/blob URL, return it as redirect
    if (attachment.url.startsWith('http')) {
      return NextResponse.json({ url: attachment.url, name: attachment.name }, { status: 200 });
    }

    return NextResponse.json(
      { error: "No se pudo obtener el archivo" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Attachment download error:", error);
    return NextResponse.json(
      { error: "Error al obtener el archivo" },
      { status: 500 }
    );
  }
}
