import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";

interface DopaminePrimer {
  id: string;
  title: string;
  description?: string;
  type: "creative" | "social" | "problem-solving";
  duration: string;
  isSystem: boolean;
  taskId?: string;
}

const SYSTEM_PRIMERS: DopaminePrimer[] = [
  {
    id: "sys-social-1",
    title: "Envía un mensaje de agradecimiento",
    description: "Escribe un mensaje corto a un compañero de equipo o amigo dándole las gracias por algo reciente.",
    type: "social",
    duration: "3 min",
    isSystem: true,
  },
  {
    id: "sys-social-2",
    title: "Comparte una chispa de humor",
    description: "Busca un meme divertido o un chiste corto y compártelo en el canal de chat de tu equipo.",
    type: "social",
    duration: "2 min",
    isSystem: true,
  },
  {
    id: "sys-creative-1",
    title: "Dibuja un garabato libre",
    description: "Toma un papel y dibuja lo primero que se te ocurra durante 3 minutos sin juzgar el resultado.",
    type: "creative",
    duration: "3 min",
    isSystem: true,
  },
  {
    id: "sys-creative-2",
    title: "Tormenta de ideas locas",
    description: "Anota 3 soluciones absurdas o divertidas a un problema que tengas en mente hoy.",
    type: "creative",
    duration: "5 min",
    isSystem: true,
  },
  {
    id: "sys-problem-1",
    title: "Despeja tu espacio físico",
    description: "Ordena exactamente 5 objetos de tu escritorio que estén fuera de lugar. Sentirás orden instantáneo.",
    type: "problem-solving",
    duration: "4 min",
    isSystem: true,
  },
  {
    id: "sys-problem-2",
    title: "Completa un acertijo rápido",
    description: "Resuelve un sudoku rápido, un rompecabezas mental o lee un dato curioso.",
    type: "problem-solving",
    duration: "5 min",
    isSystem: true,
  }
];

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateOrgApiKey(request);
    if (!auth) return apiError("Unauthorized", 401);

    // Query user tasks matching low weight / short duration
    const userTasks = await prisma.task.findMany({
      where: {
        status: { notIn: ["DONE", "completed"] },
        project: { organizationId: auth.organizationId }
      }
    });

    const customPrimers: DopaminePrimer[] = [];

    userTasks.forEach((task) => {
      if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
        const metrics = task.tdahMetrics as Record<string, any>;
        const dopamineSource = metrics.dopamineSource;
        const timeBlock = metrics.timeBlock;
        const weight = metrics.emotionalWeight || 1;

        // Low weight and short time block tasks can be booster activities
        if (
          (weight <= 2.5) &&
          (timeBlock === "15min" || timeBlock === "30min")
        ) {
          customPrimers.push({
            id: `task-${task.id}`,
            title: task.title,
            description: task.description || undefined,
            type: (dopamineSource as "creative" | "social" | "problem-solving") || "problem-solving",
            duration: timeBlock === "15min" ? "15 min" : "30 min",
            isSystem: false,
            taskId: task.id
          });
        }
      }
    });

    const allPrimers = [...SYSTEM_PRIMERS, ...customPrimers];
    
    // Choose one random primer
    const randomPrimer = allPrimers[Math.floor(Math.random() * allPrimers.length)];

    return Response.json(randomPrimer);
  } catch (error: any) {
    console.error("Error en GET /api/v1/focus/primer:", error);
    return apiError(error.message || "Error interno del servidor", 500);
  }
}
