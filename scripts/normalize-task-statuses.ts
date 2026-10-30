import { PrismaClient } from "@prisma/client";
import { CANONICAL_TASK_STATUSES, normalizeCanonicalStatus } from "../lib/task-status";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando normalización de status polimórfico en Neon DB...");

  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      stageId: true,
      pipelineId: true,
    },
  });

  console.log(`Total de tareas a revisar: ${tasks.length}`);

  let updatedCount = 0;

  for (const task of tasks) {
    let newStatus = task.status;
    let newStageId = task.stageId;

    // Check if current status is actually a stage ID (CUID/UUID)
    const isStageId = task.status && !CANONICAL_TASK_STATUSES.includes(task.status as any);

    if (isStageId) {
      const stage = await prisma.taskPipelineStage.findUnique({
        where: { id: task.status },
        select: { id: true, name: true, pipelineId: true },
      });

      if (stage) {
        newStageId = stage.id;
        const stageName = stage.name.toUpperCase();
        if (/HECHO|COMPLETAD|DONE|FINALIZAD/.test(stageName)) {
          newStatus = "DONE";
        } else if (/PROGRES|DOING|WIP/.test(stageName)) {
          newStatus = "INPROGRESS";
        } else if (/REVIS|REVIEW/.test(stageName)) {
          newStatus = "INREVIEW";
        } else {
          newStatus = "TODO";
        }
      } else {
        newStatus = normalizeCanonicalStatus(task.status);
      }
    } else {
      newStatus = normalizeCanonicalStatus(task.status);
    }

    if (newStatus !== task.status || newStageId !== task.stageId) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: newStatus,
          stageId: newStageId,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Normalización completada. Tareas actualizadas: ${updatedCount}/${tasks.length}`);
}

main()
  .catch((e) => {
    console.error("Error al normalizar tareas:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
