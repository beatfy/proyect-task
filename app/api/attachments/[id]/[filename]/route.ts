import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessTask } from "@/lib/authz";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "uploads", "task-attachments");

// GET /api/attachments/[id]/[filename] — stream a local attachment by taskId + filename
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: taskId, filename } = await params;

  if (!taskId || !filename || taskId.includes("..") || filename.includes("..")) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const expectedUrl = `/api/attachments/${taskId}/${filename}`;
    const attachment = await prisma.attachment.findFirst({
      where: {
        OR: [
          { taskId, url: expectedUrl },
          { url: expectedUrl },
        ],
      },
    });

    const targetTaskId = attachment?.taskId || taskId;
    const hasAccess = await canAccessTask(authResult.userId, targetTaskId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "No tienes acceso a este archivo" },
        { status: 403 }
      );
    }

    const localPath = join(UPLOAD_DIR, taskId, filename);
    if (!existsSync(localPath)) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(localPath);
    const displayName = attachment?.name || filename;
    const ext = displayName.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      txt: "text/plain",
    };
    const contentType = mimeMap[ext || ""] || "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(displayName)}"`);
    headers.set("Content-Length", String(fileBuffer.length));
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error) {
    console.error("Attachment download error:", error);
    return NextResponse.json(
      { error: "Error al obtener el archivo" },
      { status: 500 }
    );
  }
}
