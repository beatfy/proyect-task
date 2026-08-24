import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { MindMapData } from "@/lib/types/mindmap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { nodeId, projectId, priority, dueDate } = body;

    if (!nodeId) {
      return NextResponse.json({ error: "Falta nodeId" }, { status: 400 });
    }

    const mindMap = await prisma.mindMap.findFirst({
      where: {
        id,
        userId: authResult.userId,
      },
    });

    if (!mindMap) {
      return NextResponse.json({ error: "Mapa mental no encontrado" }, { status: 404 });
    }

    const mapData = mindMap.data as unknown as MindMapData;
    const node = mapData?.nodes?.find((n) => n.id === nodeId);

    if (!node) {
      return NextResponse.json({ error: "Nodo no encontrado en el mapa mental" }, { status: 404 });
    }

    // Build description including checklist if present
    let taskDescription = node.description || "";
    if (node.checklist && node.checklist.length > 0) {
      const checklistText = node.checklist
        .map((item) => `- [${item.completed ? "x" : " "}] ${item.text}`)
        .join("\n");
      taskDescription = taskDescription
        ? `${taskDescription}\n\n### Subtareas:\n${checklistText}`
        : `### Subtareas:\n${checklistText}`;
    }

    // Create the task in taskProject
    const targetProjectId = projectId || mindMap.projectId || null;
    const task = await prisma.task.create({
      data: {
        id: cuid(),
        title: node.label.replace(/^[^\w\s]+/, "").trim() || node.label,
        description: taskDescription || null,
        status: "TODO",
        priority: priority || node.priority || "NONE",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: targetProjectId,
        creatorId: authResult.userId,
        assigneeId: authResult.userId,
      },
    });

    // Update the node in the mind map to link to the created task
    const updatedNodes = mapData.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          taskId: task.id,
          taskTitle: task.title,
        };
      }
      return n;
    });

    await prisma.mindMap.update({
      where: { id },
      data: {
        data: JSON.parse(
          JSON.stringify({
            ...mapData,
            nodes: updatedNodes,
          })
        ),
      },
    });

    return NextResponse.json({
      message: "Tarea creada exitosamente desde el mapa mental",
      task,
      nodeId,
    });
  } catch (error) {
    console.error("Error al exportar nodo a tarea:", error);
    return NextResponse.json({ error: "Error al crear la tarea" }, { status: 500 });
  }
}
