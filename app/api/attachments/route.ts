import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { put, del } from "@vercel/blob";
import { cuid } from "@/lib/utils";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "")
    .substring(0, 100);
}

// GET attachments for a task
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId requerido" }, { status: 400 });
  }

  try {
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener archivos" },
      { status: 500 }
    );
  }
}

// POST upload attachment → Vercel Blob
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const taskId = formData.get("taskId") as string | null;

    if (!file || !taskId) {
      return NextResponse.json(
        { error: "file y taskId requeridos" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo de archivo no permitido: ${file.type}. Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y PDF.`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `El archivo supera el límite de 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        },
        { status: 400 }
      );
    }

    // Sanitize filename
    const safeName = sanitizeFilename(file.name);
    const timestamp = Date.now();
    const ext = safeName.split(".").pop() || "bin";
    const uniqueName = `${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to Vercel Blob
    const key = `task-attachments/${taskId}/${uniqueName}`;
    const blob = await put(key, file, {
      access: "public",
    });

    // Determine type
    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.includes("pdf")) type = "pdf";

    // Save to database with Blob URL
    const attachment = await prisma.attachment.create({
      data: {
        id: cuid(),
        name: safeName,
        url: blob.url,
        type,
        size: file.size,
        taskId,
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Error al subir archivo" },
      { status: 500 }
    );
  }
}

// DELETE attachment → remove from Vercel Blob + DB
export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { task: { select: { creatorId: true, assigneeId: true } } },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    // Verify ownership
    const isCreator = attachment.task.creatorId === authResult.userId;
    const isAssignee = attachment.task.assigneeId === authResult.userId;
    if (!isCreator && !isAssignee) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar este archivo" },
        { status: 403 }
      );
    }

    // Delete from Vercel Blob
    try {
      await del(attachment.url);
    } catch (blobError) {
      console.error("Blob delete failed (continuing with DB delete):", blobError);
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar archivo" },
      { status: 500 }
    );
  }
}
