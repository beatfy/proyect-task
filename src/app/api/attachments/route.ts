import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

// GET attachments for a task
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(attachments);
  } catch {
    return NextResponse.json({ error: "Error al obtener archivos" }, { status: 500 });
  }
}

// POST upload attachment
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const taskId = formData.get("taskId") as string | null;

    if (!file || !taskId) {
      return NextResponse.json({ error: "file y taskId requeridos" }, { status: 400 });
    }

    // Generate filename
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Save to public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "public", "uploads");
    const filepath = join(uploadDir, filename);

    await writeFile(filepath, buffer);

    // Determine type
    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.includes("pdf")) type = "pdf";
    else if (file.type.includes("sheet") || file.type.includes("excel")) type = "spreadsheet";

    // Save to database
    const attachment = await prisma.attachment.create({
      data: {
        name: file.name,
        url: `/uploads/${filename}`,
        type,
        size: file.size,
        taskId
      }
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}

// DELETE attachment
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id }
    });

    if (attachment) {
      // Delete file
      const filepath = join(process.cwd(), "public", attachment.url);
      try {
        await unlink(filepath);
      } catch {
        // File might not exist
      }

      // Delete from database
      await prisma.attachment.delete({
        where: { id }
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar archivo" }, { status: 500 });
  }
}