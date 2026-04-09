import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  TODO: "Por hacer",
  INPROGRESS: "En progreso",
  INREVIEW: "En revisión",
  DONE: "Hecho",
};

const priorityLabels: Record<string, string> = {
  NONE: "Sin prioridad",
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format");

    if (!projectId || !format) {
      return NextResponse.json(
        { error: "projectId y format son requeridos" },
        { status: 400 }
      );
    }

    if (!["csv", "pdf"].includes(format)) {
      return NextResponse.json(
        { error: "format debe ser csv o pdf" },
        { status: 400 }
      );
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        parentId: null,
        OR: [
          { creatorId: authResult.userId },
          { assigneeId: authResult.userId },
          { taskAssignees: { some: { userId: authResult.userId } } },
        ],
      },
      include: {
        assignee: { select: { name: true, email: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = tasks.map((t) => ({
      title: t.title,
      description: (t.description || "").replace(/"/g, '""').replace(/\n/g, " "),
      status: statusLabels[t.status] || t.status,
      priority: priorityLabels[t.priority] || t.priority,
      assignee: t.assignee?.name || t.assignee?.email || "Sin asignar",
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-ES") : "",
      createdAt: new Date(t.createdAt).toLocaleDateString("es-ES"),
    }));

    if (format === "csv") {
      const header = "Título,Descripción,Estado,Prioridad,Asignado,Fecha límite,Creado";
      const csv = [
        header,
        ...rows.map(
          (r) =>
            `"${r.title}","${r.description}","${r.status}","${r.priority}","${r.assignee}","${r.dueDate}","${r.createdAt}"`
        ),
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tareas-${projectId}.csv"`,
        },
      });
    }

    // PDF
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text(`Tareas - ${tasks[0]?.project?.name || "Proyecto"}`, 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [["Título", "Estado", "Prioridad", "Asignado", "Fecha límite", "Creado"]],
      body: rows.map((r) => [
        r.title,
        r.status,
        r.priority,
        r.assignee,
        r.dueDate,
        r.createdAt,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tareas-${projectId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
