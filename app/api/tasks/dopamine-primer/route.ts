import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getUserOrgIds } from "@/lib/tenant";

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
    id: "sys-creative-3",
    title: "Escucha música consciente",
    description: "Cierra los ojos y escucha una canción estimulante, prestando atención exclusiva a los instrumentos.",
    type: "creative",
    duration: "4 min",
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
  },
  {
    id: "sys-problem-3",
    title: "Archiva 3 correos pendientes",
    description: "Abre tu bandeja de entrada y procesa o archiva exactamente 3 correos. Rápido y sin pensar demasiado.",
    type: "problem-solving",
    duration: "3 min",
    isSystem: true,
  }
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);

    // Fetch user tasks matching ADHD criteria
    const userTasks = await prisma.task.findMany({
      where: {
        status: {
          notIn: ["DONE", "completed"]
        },
        OR: [
          { creatorId: authResult.userId },
          { assigneeId: authResult.userId },
          { taskAssignees: { some: { userId: authResult.userId } } },
          { project: { organizationId: { in: userOrgIds } } },
        ],
      }
    });

    const customPrimers: DopaminePrimer[] = [];

    userTasks.forEach((task) => {
      if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
        const metrics = task.tdahMetrics as Record<string, any>;
        const dopamineSource = metrics.dopamineSource;
        const timeBlock = metrics.timeBlock;

        // If task matches short time block (15min) and dopamine source is one of the desired ones
        if (
          (dopamineSource === "creative" || dopamineSource === "social" || dopamineSource === "problem-solving") &&
          (timeBlock === "15min" || timeBlock === "30min")
        ) {
          customPrimers.push({
            id: `task-${task.id}`,
            title: task.title,
            description: task.description || undefined,
            type: dopamineSource as "creative" | "social" | "problem-solving",
            duration: timeBlock === "15min" ? "15 min" : "30 min",
            isSystem: false,
            taskId: task.id
          });
        }
      }
    });

    // Merge system primers and custom ones, then shuffle
    const allPrimers = [...SYSTEM_PRIMERS, ...customPrimers];
    const shuffled = allPrimers.sort(() => 0.5 - Math.random());

    // Select 3 unique primers, trying to have different types if possible
    const selected: DopaminePrimer[] = [];
    const usedTypes = new Set<string>();

    // First pass: try to get different types
    for (const primer of shuffled) {
      if (!usedTypes.has(primer.type)) {
        selected.push(primer);
        usedTypes.add(primer.type);
      }
      if (selected.length === 3) break;
    }

    // Second pass: fill up to 3 if not enough unique types
    if (selected.length < 3) {
      for (const primer of shuffled) {
        if (!selected.some(s => s.id === primer.id)) {
          selected.push(primer);
        }
        if (selected.length === 3) break;
      }
    }

    return NextResponse.json(selected);
  } catch (error) {
    console.error("Get dopamine primers error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
