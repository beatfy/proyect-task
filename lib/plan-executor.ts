import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export interface PlanTask {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "NONE";
  daysFromNow?: number;
  subtasks?: string[];
  comments?: string[];
}

export interface PlanPhase {
  name: string;
  color?: string;
  tasks: PlanTask[];
}

export interface PlanData {
  pipelineName: string;
  description?: string;
  projectId?: string;
  phases: PlanPhase[];
}

export interface PlanExecutionResult {
  success: boolean;
  projectId: string;
  projectName: string;
  pipelineId: string;
  pipelineName: string;
  totalStages: number;
  totalTasks: number;
  totalSubtasks: number;
  totalComments: number;
  url: string;
}

const DEFAULT_PHASE_COLORS = [
  "#3b82f6", // azul
  "#8b5cf6", // morado
  "#ec4899", // rosa
  "#f59e0b", // ámbar
  "#10b981", // esmeralda
  "#06b6d4", // cian
  "#6366f1", // índigo
];

/**
 * Executes and ingests a structured plan into a dedicated Pipeline inside a Project/Client.
 */
export async function executePlanToPipeline({
  planData,
  userId,
  projectId,
}: {
  planData: PlanData;
  userId: string;
  projectId?: string | null;
}): Promise<PlanExecutionResult> {
  if (!planData || !planData.phases || !Array.isArray(planData.phases) || planData.phases.length === 0) {
    throw new Error("El plan debe contener al menos una fase con tareas.");
  }

  // 1. Resolve target Project/Client
  let targetProjectId = projectId || planData.projectId;
  let targetProject = null;

  if (targetProjectId) {
    targetProject = await prisma.project.findUnique({
      where: { id: targetProjectId },
      select: { id: true, name: true, organizationId: true },
    });
  }

  // If no project specified or not found, try finding the user's primary project
  if (!targetProject) {
    targetProject = await prisma.project.findFirst({
      where: {
        OR: [
          { members: { some: { userId } } },
          { organization: { members: { some: { userId } } } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, organizationId: true },
    });
  }

  // If still no project, create a new one for this client
  if (!targetProject) {
    const newProjName = planData.pipelineName
      ? planData.pipelineName.replace(/^Plan de Negocio:\s*/i, "").trim()
      : "Mi Proyecto";

    targetProject = await prisma.project.create({
      data: {
        id: cuid(),
        name: newProjName || "Proyecto General",
        description: planData.description || "Proyecto creado automáticamente desde el plan",
        color: "#6366f1",
        members: {
          create: {
            id: cuid(),
            userId,
            role: "OWNER",
          },
        },
      },
      select: { id: true, name: true, organizationId: true },
    });
  }

  targetProjectId = targetProject.id;
  const pipelineName = (planData.pipelineName || "Plan de Negocio").trim();

  // 2. Perform Transaction: Pipeline -> Stages -> Tasks -> Subtasks -> Comments
  let totalTasks = 0;
  let totalSubtasks = 0;
  let totalComments = 0;

  const resultPipeline = await prisma.$transaction(async (tx) => {
    // A) Create TaskPipeline inside this project
    const pipeline = await tx.taskPipeline.create({
      data: {
        id: cuid(),
        name: pipelineName,
        isDefault: false,
        projectId: targetProjectId,
        organizationId: targetProject!.organizationId || null,
        stages: {
          create: planData.phases.map((phase, idx) => ({
            id: cuid(),
            name: phase.name || `Fase ${idx + 1}`,
            color: phase.color || DEFAULT_PHASE_COLORS[idx % DEFAULT_PHASE_COLORS.length],
            position: idx,
          })),
        },
      },
      include: {
        stages: {
          orderBy: { position: "asc" },
        },
      },
    });

    const now = Date.now();

    // B) Iterate phases and create tasks
    for (let pIdx = 0; pIdx < planData.phases.length; pIdx++) {
      const phase = planData.phases[pIdx];
      const stage = pipeline.stages[pIdx] || pipeline.stages[0];

      if (!phase.tasks || !Array.isArray(phase.tasks)) continue;

      for (let tIdx = 0; tIdx < phase.tasks.length; tIdx++) {
        const item = phase.tasks[tIdx];
        if (!item.title || !item.title.trim()) continue;

        // Calculate relative dueDate
        let dueDate: Date | null = null;
        if (typeof item.daysFromNow === "number" && !isNaN(item.daysFromNow)) {
          dueDate = new Date(now + Math.max(0, item.daysFromNow) * 24 * 60 * 60 * 1000);
        }

        const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT", "NONE"];
        const priority = (item.priority && validPriorities.includes(item.priority.toUpperCase()))
          ? item.priority.toUpperCase()
          : "NONE";

        // Create parent task
        const parentTask = await tx.task.create({
          data: {
            id: cuid(),
            title: item.title.trim(),
            description: item.description?.trim() || null,
            status: "TODO",
            priority,
            dueDate,
            projectId: targetProjectId,
            creatorId: userId,
            pipelineId: pipeline.id,
            stageId: stage.id,
            order: tIdx,
          },
        });
        totalTasks++;

        // Create Subtasks if any
        if (item.subtasks && Array.isArray(item.subtasks) && item.subtasks.length > 0) {
          for (let sIdx = 0; sIdx < item.subtasks.length; sIdx++) {
            const stItem = item.subtasks[sIdx];
            const subTitle = typeof stItem === "string" ? stItem.trim() : (stItem as any)?.title?.trim();
            if (!subTitle) continue;

            await tx.task.create({
              data: {
                id: cuid(),
                title: subTitle,
                status: "TODO",
                priority,
                projectId: targetProjectId,
                creatorId: userId,
                parentId: parentTask.id,
                order: sIdx,
                pipelineId: pipeline.id,
                stageId: stage.id,
              },
            });
            totalSubtasks++;
          }
        }

        // Create Comments/Notes if any
        if (item.comments && Array.isArray(item.comments) && item.comments.length > 0) {
          for (const comm of item.comments) {
            const commentText = typeof comm === "string" ? comm.trim() : (comm as any)?.content?.trim();
            if (!commentText) continue;

            await tx.comment.create({
              data: {
                id: cuid(),
                content: commentText,
                taskId: parentTask.id,
                authorId: userId,
              },
            });
            totalComments++;
          }
        }
      }
    }

    return pipeline;
  });

  return {
    success: true,
    projectId: targetProjectId,
    projectName: targetProject.name,
    pipelineId: resultPipeline.id,
    pipelineName: resultPipeline.name,
    totalStages: resultPipeline.stages.length,
    totalTasks,
    totalSubtasks,
    totalComments,
    url: `/projects/${targetProjectId}?pipelineId=${resultPipeline.id}`,
  };
}
