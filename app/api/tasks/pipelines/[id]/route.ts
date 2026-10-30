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
        const currentStages = await tx.taskPipelineStage.findMany({
          where: { pipelineId },
        });
        const currentStageIds = currentStages.map((s) => s.id);
        const inputStageIds = stages.map((s) => s.id).filter(Boolean) as string[];
        const toDeleteIds = currentStageIds.filter((id) => !inputStageIds.includes(id));

        // Step A: Temporarily shift all existing stages to negative positions
        // to avoid @@unique([pipelineId, position]) collisions while reordering/creating
        for (let idx = 0; idx < currentStages.length; idx++) {
          await tx.taskPipelineStage.update({
            where: { id: currentStages[idx].id },
            data: { position: -(idx + 1000) },
          });
        }

        // Step B: Create new stages and update kept existing stages to their target positions
        const keptOrCreatedStages: { id: string; position: number }[] = [];

        for (const stage of stages) {
          if (stage.id && toDeleteIds.includes(stage.id)) continue;

          if (stage.id && currentStageIds.includes(stage.id)) {
            await tx.taskPipelineStage.update({
              where: { id: stage.id },
              data: {
                name: stage.name.trim(),
                position: stage.position,
                color: stage.color || "#6366f1",
              },
            });
            keptOrCreatedStages.push({ id: stage.id, position: stage.position });
          } else {
            const newStageId = stage.id || cuid();
            await tx.taskPipelineStage.create({
              data: {
                id: newStageId,
                name: stage.name.trim(),
                position: stage.position,
                color: stage.color || "#6366f1",
                pipelineId,
              },
            });
            keptOrCreatedStages.push({ id: newStageId, position: stage.position });
          }
        }

        // Step C: Move tasks from stages being deleted to the lowest-position kept/created stage
        if (toDeleteIds.length > 0) {
          keptOrCreatedStages.sort((a, b) => a.position - b.position);
          const fallbackStageId = keptOrCreatedStages[0]?.id || null;

          await tx.task.updateMany({
            where: { stageId: { in: toDeleteIds } },
            data: { stageId: fallbackStageId },
          });

          await tx.taskPipelineStage.deleteMany({
            where: { id: { in: toDeleteIds } },
          });
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
