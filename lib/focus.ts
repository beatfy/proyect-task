export interface DopaminePrimer {
  id: string;
  title: string;
  description?: string;
  type: "creative" | "social" | "problem-solving";
  duration: string;
  isSystem: boolean;
  taskId?: string;
}

export const SYSTEM_PRIMERS: DopaminePrimer[] = [
  {
    id: "sys-social-1",
    title: "Envía un mensaje de agradecimiento",
    description:
      "Escribe un mensaje corto a un compañero de equipo o amigo dándole las gracias por algo reciente.",
    type: "social",
    duration: "3 min",
    isSystem: true,
  },
  {
    id: "sys-social-2",
    title: "Comparte una chispa de humor",
    description:
      "Busca un meme divertido o un chiste corto y compártelo en el canal de chat de tu equipo.",
    type: "social",
    duration: "2 min",
    isSystem: true,
  },
  {
    id: "sys-creative-1",
    title: "Dibuja un garabato libre",
    description:
      "Toma un papel y dibuja lo primero que se te ocurra durante 3 minutos sin juzgar el resultado.",
    type: "creative",
    duration: "3 min",
    isSystem: true,
  },
  {
    id: "sys-creative-2",
    title: "Tormenta de ideas locas",
    description:
      "Anota 3 soluciones absurdas o divertidas a un problema que tengas en mente hoy.",
    type: "creative",
    duration: "5 min",
    isSystem: true,
  },
  {
    id: "sys-creative-3",
    title: "Escucha música consciente",
    description:
      "Cierra los ojos y escucha una canción estimulante, prestando atención exclusiva a los instrumentos.",
    type: "creative",
    duration: "4 min",
    isSystem: true,
  },
  {
    id: "sys-problem-1",
    title: "Despeja tu espacio físico",
    description:
      "Ordena exactamente 5 objetos de tu escritorio que estén fuera de lugar. Sentirás orden instantáneo.",
    type: "problem-solving",
    duration: "4 min",
    isSystem: true,
  },
  {
    id: "sys-problem-2",
    title: "Completa un acertijo rápido",
    description:
      "Resuelve un sudoku rápido, un rompecabezas mental o lee un dato curioso.",
    type: "problem-solving",
    duration: "5 min",
    isSystem: true,
  },
  {
    id: "sys-problem-3",
    title: "Archiva 3 correos pendientes",
    description:
      "Abre tu bandeja de entrada y procesa o archiva exactamente 3 correos. Rápido y sin pensar demasiado.",
    type: "problem-solving",
    duration: "3 min",
    isSystem: true,
  },
];

export interface FocusTaskLike {
  id: string;
  title: string;
  description?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  tdahMetrics?: unknown;
  [key: string]: unknown;
}

/**
 * Extracts custom dopamine primers from short, low-friction user tasks.
 */
export function extractCustomPrimersFromTasks(tasks: FocusTaskLike[]): DopaminePrimer[] {
  const customPrimers: DopaminePrimer[] = [];

  for (const task of tasks) {
    if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metrics = task.tdahMetrics as Record<string, any>;
      const dopamineSource = metrics.dopamineSource;
      const timeBlock = metrics.timeBlock;
      const weight = typeof metrics.emotionalWeight === "number" ? metrics.emotionalWeight : 1;

      const isBoostSource =
        dopamineSource === "creative" ||
        dopamineSource === "social" ||
        dopamineSource === "problem-solving";

      if (
        (isBoostSource || weight <= 2.5) &&
        (timeBlock === "15min" || timeBlock === "30min")
      ) {
        customPrimers.push({
          id: `task-${task.id}`,
          title: task.title,
          description: task.description || undefined,
          type: isBoostSource ? dopamineSource : "problem-solving",
          duration: timeBlock === "15min" ? "15 min" : "30 min",
          isSystem: false,
          taskId: task.id,
        });
      }
    }
  }

  return customPrimers;
}

/**
 * Selects up to `count` diverse dopamine primers (mixing system and custom task primers).
 */
export function selectDopaminePrimers(
  tasks: FocusTaskLike[],
  count: number = 3
): DopaminePrimer[] {
  const customPrimers = extractCustomPrimersFromTasks(tasks);
  const allPrimers = [...SYSTEM_PRIMERS, ...customPrimers];
  const shuffled = [...allPrimers].sort(() => 0.5 - Math.random());

  if (count <= 1) {
    return shuffled.slice(0, 1);
  }

  const selected: DopaminePrimer[] = [];
  const usedTypes = new Set<string>();

  for (const primer of shuffled) {
    if (!usedTypes.has(primer.type)) {
      selected.push(primer);
      usedTypes.add(primer.type);
    }
    if (selected.length === count) break;
  }

  if (selected.length < count) {
    for (const primer of shuffled) {
      if (!selected.some((s) => s.id === primer.id)) {
        selected.push(primer);
      }
      if (selected.length === count) break;
    }
  }

  return selected;
}

/**
 * Computes escalated TDAH metrics (streakDays, emotionalWeight, isPromoted),
 * filters by energy level if provided, and sorts tasks by Focus Queue priority.
 */
export function buildFocusQueue<T extends FocusTaskLike>(
  tasks: T[],
  options?: { energyFilter?: string | null; limit?: number; now?: Date }
) {
  const now = options?.now || new Date();
  const energyFilter = options?.energyFilter;

  const processedTasks = tasks.map((task) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metrics: Record<string, any> = {};
    if (task.tdahMetrics && typeof task.tdahMetrics === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metrics = { ...(task.tdahMetrics as Record<string, any>) };
    }

    const baseWeight =
      typeof metrics.emotionalWeight === "number" ? metrics.emotionalWeight : 1;
    const energyRequired = metrics.energyRequired || "medium";
    const timeBlock = metrics.timeBlock || "30min";
    const blocksSomeone = !!metrics.blocksSomeone;
    const dopamineSource = metrics.dopamineSource || "routine";
    const updatedAtIso =
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : String(task.updatedAt);
    const lastTouchedStr = metrics.lastTouched || updatedAtIso;
    const blockReason = metrics.blockReason || null;

    const lastTouchedDate = new Date(lastTouchedStr);
    const diffTime = Math.abs(now.getTime() - lastTouchedDate.getTime());
    const streakDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Auto-escalation rule: +0.5 weight per day untouched (max 5)
    const emotionalWeight = Math.min(5, baseWeight + 0.5 * streakDays);

    // Promotion rule: streak > 3 days and blocks someone
    const isPromoted = streakDays > 3 && blocksSomeone;

    return {
      ...task,
      tdahMetrics: {
        emotionalWeight,
        baseWeight,
        energyRequired,
        timeBlock,
        blocksSomeone,
        dopamineSource,
        lastTouched: lastTouchedStr,
        streakDays,
        isPromoted,
        blockReason,
      },
    };
  });

  let filtered = processedTasks;
  if (energyFilter) {
    filtered = processedTasks.filter(
      (t) => t.tdahMetrics.energyRequired === energyFilter
    );
  }

  filtered.sort((a, b) => {
    if (a.tdahMetrics.isPromoted && !b.tdahMetrics.isPromoted) return -1;
    if (!a.tdahMetrics.isPromoted && b.tdahMetrics.isPromoted) return 1;

    if (b.tdahMetrics.emotionalWeight !== a.tdahMetrics.emotionalWeight) {
      return b.tdahMetrics.emotionalWeight - a.tdahMetrics.emotionalWeight;
    }
    if (b.tdahMetrics.streakDays !== a.tdahMetrics.streakDays) {
      return b.tdahMetrics.streakDays - a.tdahMetrics.streakDays;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (options?.limit && options.limit > 0) {
    return filtered.slice(0, options.limit);
  }

  return filtered;
}
