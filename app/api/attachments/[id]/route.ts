import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { get } from "@vercel/blob";

// GET /api/attachments/[id] — stream a private attachment (verifies auth)
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

    // Fetch the private blob via SDK
    const result = await get(attachment.url, { access: "private" });

    if (!result || !result.stream) {
      return NextResponse.json(
        { error: "No se pudo obtener el archivo" },
        { status: 500 }
      );
    }

    // Stream the blob content back to the client
    const headers = new Headers();
    headers.set(
      "Content-Type",
      result.blob.contentType || "application/octet-stream"
    );
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.name)}"`
    );
    if (result.blob.size) {
      headers.set("Content-Length", String(result.blob.size));
    }
    // Cache briefly to avoid hammering Vercel Blob on repeated views
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(result.stream, { status: 200, headers });
  } catch (error) {
    console.error("Attachment download error:", error);
    return NextResponse.json(
      { error: "Error al obtener el archivo" },
      { status: 500 }
    );
  }
}
