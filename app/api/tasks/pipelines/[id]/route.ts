import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { canAccessProject, verifyOrgMembership } from "@/lib/tenant";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: pipelineId } = await params;
    const body = await request.json();
    const { name, stages } = body;

    const pipeline = await prisma.taskPipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
    }

    // Auth check
    if (pipeline.projectId) {
      const hasAccess = await canAccessProject(authResult.userId, pipeline.projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }
    if (pipeline.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, pipeline.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    // Start Transaction
    const updatedPipeline = await prisma.$transaction(async (tx) => {
      // 1. Rename pipeline if provided
      if (name && name.trim()) {
        await tx.taskPipeline.update({
          where: { id: pipelineId },
          data: { name: name.trim() },
        });
      }

      // 2. Sync stages if provided
      if (Array.isArray(stages)) {
        // Fetch current stages
        const currentStages = await tx.taskPipelineStage.findMany({
          where: { pipelineId },
        });
        const currentStageIds = currentStages.map((s) => s.id);

        // Map inputs
        const inputStageIds = stages.map((s) => s.id).filter(Boolean) as string[];

        // Identify stages to delete
        const toDeleteIds = currentStageIds.filter((id) => !inputStageIds.includes(id));

        // Find fallback stage (lowest position among the kept/new stages)
        const keptInputStages = stages.filter((s) => !s.id || !toDeleteIds.includes(s.id));
        keptInputStages.sort((a, b) => a.position - b.position);
        
        let fallbackStageId: string | null = null;
        if (keptInputStages.length > 0) {
          const firstKept = keptInputStages[0];
          if (firstKept.id) {
            fallbackStageId = firstKept.id;
          } else {
            // It's a new stage, let's pre-assign a cuid to it
            firstKept.id = cuid();
            fallbackStageId = firstKept.id;
          }
        }

        // Before deleting stages, move their tasks to the fallback stage
        if (toDeleteIds.length > 0 && fallbackStageId) {
          await tx.task.updateMany({
            where: { stageId: { in: toDeleteIds } },
            data: { stageId: fallbackStageId },
          });
        }

        // Now delete the stages
        if (toDeleteIds.length > 0) {
          await tx.taskPipelineStage.deleteMany({
            where: { id: { in: toDeleteIds } },
          });
        }

        // Create or Update stages
        for (const stage of stages) {
          if (toDeleteIds.includes(stage.id)) continue;

          if (stage.id) {
            // Update
            await tx.taskPipelineStage.update({
              where: { id: stage.id },
              data: {
                name: stage.name.trim(),
                position: stage.position,
                color: stage.color || "#6366f1",
              },
            });
          } else {
            // Create
            const newStageId = stage.id || cuid(); // Use pre-assigned id if fallback, otherwise new cuid
            await tx.taskPipelineStage.create({
              data: {
                id: newStageId,
                name: stage.name.trim(),
                position: stage.position,
                color: stage.color || "#6366f1",
                pipelineId,
              },
            });
          }
        }
      }

      return tx.taskPipeline.findUnique({
        where: { id: pipelineId },
        include: {
          stages: {
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return NextResponse.json(updatedPipeline);
  } catch (error) {
    console.error("Update task pipeline error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: pipelineId } = await params;

    const pipeline = await prisma.taskPipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
    }

    // Auth check
    if (pipeline.projectId) {
      const hasAccess = await canAccessProject(authResult.userId, pipeline.projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }
    }
    if (pipeline.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, pipeline.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    await prisma.taskPipeline.delete({
      where: { id: pipelineId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task pipeline error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
