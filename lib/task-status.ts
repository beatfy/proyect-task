import { PrismaClient } from "@prisma/client";

export const CANONICAL_TASK_STATUSES = ["TODO", "INPROGRESS", "INREVIEW", "DONE", "ARCHIVED"] as const;
export type CanonicalTaskStatus = (typeof CANONICAL_TASK_STATUSES)[number];

const STATUS_SYNONYMS: Record<string, CanonicalTaskStatus> = {
  // TODO
  TODO: "TODO",
  "POR HACER": "TODO",
  "POR_HACER": "TODO",
  PENDIENTE: "TODO",
  BACKLOG: "TODO",
  OPEN: "TODO",

  // INPROGRESS
  INPROGRESS: "INPROGRESS",
  IN_PROGRESS: "INPROGRESS",
  "EN PROGRESO": "INPROGRESS",
  "EN_PROGRESO": "INPROGRESS",
  DOING: "INPROGRESS",
  WIP: "INPROGRESS",

  // INREVIEW
  INREVIEW: "INREVIEW",
  IN_REVIEW: "INREVIEW",
  "EN REVISIÓN": "INREVIEW",
  "EN REVISION": "INREVIEW",
  REVIEW: "INREVIEW",

  // DONE
  DONE: "DONE",
  HECHO: "DONE",
  COMPLETADO: "DONE",
  COMPLETED: "DONE",
  FINALIZADO: "DONE",
  RESOLVED: "DONE",

  // ARCHIVED
  ARCHIVED: "ARCHIVED",
  ARCHIVADO: "ARCHIVED",
};

/**
 * Normalizes any free-form status string (including Spanish synonyms)
 * into a canonical status enum value.
 */
export function normalizeCanonicalStatus(rawStatus?: string | null): CanonicalTaskStatus {
  if (!rawStatus) return "TODO";
  const cleaned = rawStatus.trim().toUpperCase();
  return STATUS_SYNONYMS[cleaned] || "TODO";
}

/**
 * Resolves whether a given raw string is actually a Stage ID (CUID or UUID).
 * If it matches a stage in the database or task pipeline, returns the stage.
 */
export async function resolveTaskStageAndStatus(
  prisma: any,
  options: {
    rawStatus?: string | null;
    rawStageId?: string | null;
    pipelineId?: string | null;
    projectId?: string | null;
    organizationId?: string | null;
  }
): Promise<{ status: CanonicalTaskStatus; stageId: string | null; pipelineId: string | null }> {
  let { rawStatus, rawStageId, pipelineId, projectId, organizationId } = options;

  let matchedStage: { id: string; name: string; pipelineId: string } | null = null;

  // 1. Check if rawStageId is provided directly
  if (rawStageId) {
    const stage = await prisma.taskPipelineStage.findUnique({
      where: { id: rawStageId },
      select: { id: true, name: true, pipelineId: true },
    });
    if (stage) {
      matchedStage = stage;
      pipelineId = stage.pipelineId;
    }
  }

  // 2. Check if rawStatus was mistakenly passed as a Stage ID (polymorphic trap)
  if (!matchedStage && rawStatus) {
    const stage = await prisma.taskPipelineStage.findUnique({
      where: { id: rawStatus },
      select: { id: true, name: true, pipelineId: true },
    });
    if (stage) {
      matchedStage = stage;
      pipelineId = stage.pipelineId;
      rawStatus = stage.name; // Use stage name to infer canonical status
    }
  }

  // 3. If no stage found yet, lookup the default pipeline for project/org
  if (!matchedStage) {
    const pipelineWhere: Record<string, any> = {};
    if (pipelineId) {
      pipelineWhere.id = pipelineId;
    } else if (projectId) {
      pipelineWhere.projectId = projectId;
    } else if (organizationId) {
      pipelineWhere.organizationId = organizationId;
      pipelineWhere.projectId = null;
    }

    const pipeline = await prisma.taskPipeline.findFirst({
      where: pipelineWhere,
      include: { stages: { orderBy: { position: "asc" } } },
    });

    if (pipeline && pipeline.stages.length > 0) {
      pipelineId = pipeline.id;

      // Find stage matching status name
      const norm = normalizeCanonicalStatus(rawStatus);
      if (norm === "DONE") {
        matchedStage = pipeline.stages.find((s: any) => /hecho|completado|done|finalizado/i.test(s.name)) || pipeline.stages[pipeline.stages.length - 1];
      } else if (norm === "INPROGRESS") {
        matchedStage = pipeline.stages.find((s: any) => /progreso|progress|doing/i.test(s.name)) || pipeline.stages[1] || pipeline.stages[0];
      } else if (norm === "INREVIEW") {
        matchedStage = pipeline.stages.find((s: any) => /revis|review/i.test(s.name)) || pipeline.stages[2] || pipeline.stages[0];
      } else {
        matchedStage = pipeline.stages[0];
      }
    }
  }

  // 4. Derive canonical status
  let finalStatus: CanonicalTaskStatus = "TODO";
  if (rawStatus && STATUS_SYNONYMS[rawStatus.trim().toUpperCase()]) {
    finalStatus = STATUS_SYNONYMS[rawStatus.trim().toUpperCase()];
  } else if (matchedStage) {
    const stageName = matchedStage.name.trim().toUpperCase();
    if (/HECHO|COMPLETAD|DONE|FINALIZAD/.test(stageName)) {
      finalStatus = "DONE";
    } else if (/PROGRES|DOING|WIP/.test(stageName)) {
      finalStatus = "INPROGRESS";
    } else if (/REVIS|REVIEW/.test(stageName)) {
      finalStatus = "INREVIEW";
    } else {
      finalStatus = "TODO";
    }
  }

  return {
    status: finalStatus,
    stageId: matchedStage ? matchedStage.id : null,
    pipelineId: pipelineId || null,
  };
}
