import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function calculateFastingPhase(elapsedHours: number) {
  if (elapsedHours < 4) {
    return {
      phase: "Digestión y Absorción",
      code: "digestion",
      icon: "🥗",
      shortDesc: "El cuerpo procesa la última comida y absorbe nutrientes.",
      detailDesc: "Niveles de glucosa e insulina elevados. El cuerpo almacena energía en forma de glucógeno y tejido graso.",
      tips: "Mantente hidratado con agua limpia. No consumas ningún alimento sólido ni bebidas con calorías.",
    };
  } else if (elapsedHours < 8) {
    return {
      phase: "Estabilización de Glucosa",
      code: "stabilization",
      icon: "📉",
      shortDesc: "La glucosa disminuye y los niveles de insulina caen.",
      detailDesc: "El sistema digestivo se desacelera. El páncreas reduce la liberación de insulina y comienza la quema del glucógeno almacenado.",
      tips: "Si sientes ligero apetito o antojo mental, bebe un vaso de agua o té verde/infusión sin endulzantes.",
    };
  } else if (elapsedHours < 12) {
    return {
      phase: "Quema de Grasa (Cetosis Inicial)",
      code: "fat_burning",
      icon: "🔥",
      shortDesc: "El cuerpo agota el glucógeno y empieza a quemar grasa.",
      detailDesc: "La lipólisis está plenamente activada. Los ácidos grasos se liberan en el torrente sanguíneo para transformarse en energía.",
      tips: "Añade una pizca de sal marina o electrólitos sin azúcar a tu agua para prevenir mareos o pérdida de minerales.",
    };
  } else if (elapsedHours < 16) {
    return {
      phase: "Cetosis Profunda & HGH",
      code: "deep_ketosis",
      icon: "⚡",
      shortDesc: "Producción de cetonas y pico de Hormona del Crecimiento (HGH).",
      detailDesc: "El cerebro utiliza cuerpos cetónicos para combustible, mejorando la claridad mental y el foco. La HGH protege los músculos.",
      tips: "Aprovecha esta ventana de claridad mental para tareas complejas o trabajo enfocado. ¡Falta muy poco!",
    };
  } else {
    return {
      phase: "Autofagia Celular & Limpieza",
      code: "autophagy",
      icon: "🧬",
      shortDesc: "Reciclaje de células dañadas, regeneración y anti-inflamación.",
      detailDesc: "El cuerpo elimina orgánulos celulares viejos o defectuosos (autofagia). Máximo beneficio metabólico y rejuvenecimiento.",
      tips: "Planifica una comida ligera y nutritiva para romper el ayuno. Evita carbohidratos refinados o azúcares masivos de golpe.",
    };
  }
}

function calculateEatingPhase(elapsedHours: number, targetEatingHours: number) {
  const earlyPhase = 1.5;
  const closingWindow = Math.max(earlyPhase, targetEatingHours - 2);

  if (elapsedHours < earlyPhase) {
    return {
      phase: "Apertura Digestiva & Fast Breaker",
      code: "fast_breaker",
      icon: "🥣",
      shortDesc: "Reactivación suave del sistema digestivo tras el ayuno.",
      detailDesc: "Tu sensibilidad a la insulina es máxima. Tu estómago y páncreas reactivan la secreción de enzimas digestivas progresivamente.",
      tips: "Rompe el ayuno con proteínas limpias, grasas saludables (huevos, aguacate, aceite de oliva, caldo de huesos) y verduras. Evita ultraprocesados o dulces masivos de golpe.",
    };
  } else if (elapsedHours < closingWindow) {
    return {
      phase: "Ventana de Nutrición & Absorción",
      code: "nourishment",
      icon: "🍽️",
      shortDesc: "Comidas principales y reposición de macronutrientes.",
      detailDesc: "Fase óptima para aportar aminoácidos a los músculos, recargar depósitos de glucógeno y asimilar micronutrientes y vitaminas.",
      tips: "Realiza tus comidas ricas en proteínas de alta biodisponibilidad y vegetales variados. Mantén una buena ingesta de agua entre comidas.",
    };
  } else if (elapsedHours <= targetEatingHours) {
    return {
      phase: "Última Comida & Cierre de Ventana",
      code: "window_closing",
      icon: "🥑",
      shortDesc: "Preparación para el siguiente ayuno y descanso nocturno.",
      detailDesc: "Última ingesta del día. Tu cuerpo necesita tiempo para digerir adecuadamente antes del reposo y del próximo ciclo de autofagia.",
      tips: "Prioriza alimentos saciantes altos en fibra y proteína limpia. Evita carbohidratos pesados y deja 2-3 horas antes de acostarte.",
    };
  } else {
    return {
      phase: "Ventana Vencida — ¡Hora de Ayunar!",
      code: "window_ended",
      icon: "⏳",
      shortDesc: "Has alcanzado el límite de tu ventana de alimentación.",
      detailDesc: `Han transcurrido más de ${targetEatingHours} horas desde que abriste tu ventana. Para mantener los beneficios metabólicos y tu ritmo circadiano, es momento de iniciar tu nuevo ayuno.`,
      tips: "Termina tu última bebida o infusión y pulsa 'Iniciar Siguiente Ayuno' para reactivar tu temporizador.",
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;

    // Obtenemos o creamos la configuración del usuario
    let config = await prisma.fastingConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await prisma.fastingConfig.create({
        data: {
          userId,
          protocol: "16:8",
          targetFastHours: 16,
          targetEatingHours: 8,
          waterGoalMl: 2500,
          waterDrankMl: 0,
        },
      });
    }

    // Comprobar reset de agua diario
    const today = new Date();
    const lastReset = new Date(config.waterResetDate);
    const isSameDay =
      today.getFullYear() === lastReset.getFullYear() &&
      today.getMonth() === lastReset.getMonth() &&
      today.getDate() === lastReset.getDate();

    if (!isSameDay) {
      config = await prisma.fastingConfig.update({
        where: { userId },
        data: {
          waterDrankMl: 0,
          waterResetDate: today,
        },
      });
    }

    // Obtenemos el ayuno activo (aquel que no tiene fecha de fin endTime)
    const activeFast = await prisma.fastingLog.findFirst({
      where: { userId, endTime: null },
      orderBy: { startTime: "desc" },
    });

    let activeData = null;
    let eatingData = null;
    let mode: "FASTING" | "EATING_WINDOW" | "IDLE" = "IDLE";

    if (activeFast) {
      mode = "FASTING";
      const now = new Date();
      const startTime = new Date(activeFast.startTime);
      const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const targetHours = activeFast.targetHours || config.targetFastHours || 16;
      const targetMs = targetHours * 60 * 60 * 1000;
      const remainingMs = Math.max(0, targetMs - elapsedMs);
      const progressPercent = Math.min(100, Math.round((elapsedMs / targetMs) * 100));
      const isGoalReached = elapsedMs >= targetMs;
      const extraHours = isGoalReached ? Number(((elapsedMs - targetMs) / (1000 * 60 * 60)).toFixed(2)) : 0;
      const extraMinutes = isGoalReached ? Math.floor((elapsedMs - targetMs) / (1000 * 60)) : 0;

      const expectedEndTime = new Date(startTime.getTime() + targetMs);
      const currentPhase = calculateFastingPhase(elapsedHours);

      activeData = {
        id: activeFast.id,
        protocol: activeFast.protocol,
        targetHours,
        startTime: activeFast.startTime,
        elapsedHours: Number(elapsedHours.toFixed(2)),
        elapsedMinutes: Math.floor(elapsedMs / (1000 * 60)),
        remainingMinutes: Math.floor(remainingMs / (1000 * 60)),
        progressPercent,
        expectedEndTime,
        isGoalReached,
        extraHours,
        extraMinutes,
        currentPhase,
      };
    } else {
      // Si no hay ayuno activo, comprobamos si hay un ayuno previo finalizado para calcular la ventana de alimentación
      const lastFast = await prisma.fastingLog.findFirst({
        where: { userId, endTime: { not: null } },
        orderBy: { endTime: "desc" },
      });

      if (lastFast && lastFast.endTime) {
        mode = "EATING_WINDOW";
        const now = new Date();
        const startTime = new Date(lastFast.endTime);
        const elapsedMs = Math.max(0, now.getTime() - startTime.getTime());
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const targetEatingHours = config.targetEatingHours || 8;
        const targetMs = targetEatingHours * 60 * 60 * 1000;
        const remainingMs = Math.max(0, targetMs - elapsedMs);
        const progressPercent = Math.min(100, Math.round((elapsedMs / targetMs) * 100));
        const isWindowEnded = elapsedMs >= targetMs;
        const expectedEndTime = new Date(startTime.getTime() + targetMs);
        const currentPhase = calculateEatingPhase(elapsedHours, targetEatingHours);

        const hoursSinceFast = Number((elapsedMs / (1000 * 60 * 60)).toFixed(1));

        eatingData = {
          lastFastId: lastFast.id,
          startTime: lastFast.endTime,
          targetEatingHours,
          elapsedHours: Number(elapsedHours.toFixed(2)),
          elapsedMinutes: Math.floor(elapsedMs / (1000 * 60)),
          remainingMinutes: Math.floor(remainingMs / (1000 * 60)),
          progressPercent,
          expectedEndTime,
          isWindowEnded,
          hoursSinceFast,
          currentPhase,
          lastFast: {
            id: lastFast.id,
            protocol: lastFast.protocol,
            targetHours: lastFast.targetHours,
            startTime: lastFast.startTime,
            endTime: lastFast.endTime,
            durationHours: Number(((new Date(lastFast.endTime).getTime() - new Date(lastFast.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)),
            completed: lastFast.completed,
            firstMeal: lastFast.firstMeal,
          },
        };
      }
    }

    // Calcular estadísticas sobre todos los ayunos finalizados
    const finishedFasts = await prisma.fastingLog.findMany({
      where: { userId, endTime: { not: null } },
      orderBy: { startTime: "desc" },
    });

    const totalFasts = finishedFasts.length;
    let totalHours = 0;
    finishedFasts.forEach((f) => {
      if (f.endTime) {
        const h = (new Date(f.endTime).getTime() - new Date(f.startTime).getTime()) / (1000 * 60 * 60);
        totalHours += Math.max(0, h);
      }
    });

    // Racha actual (días consecutivos con al menos 1 ayuno completado o activo)
    let currentStreak = 0;
    if (finishedFasts.length > 0 || activeFast) {
      const datesWithFast = new Set<string>();
      if (activeFast) datesWithFast.add(new Date(activeFast.startTime).toISOString().split("T")[0]);
      finishedFasts.forEach((f) => datesWithFast.add(new Date(f.startTime).toISOString().split("T")[0]));

      let checkDate = new Date();
      while (true) {
        const dateStr = checkDate.toISOString().split("T")[0];
        if (datesWithFast.has(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // Si hoy no ha ayunado aún, probamos desde ayer antes de cortar la racha
          if (currentStreak === 0 && checkDate.toISOString().split("T")[0] === new Date().toISOString().split("T")[0]) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
          break;
        }
      }
    }

    return NextResponse.json({
      mode,
      config,
      activeFast: activeData,
      eatingWindow: eatingData,
      stats: {
        totalFasts,
        totalHours: Number(totalHours.toFixed(1)),
        currentStreak,
        avgHours: totalFasts > 0 ? Number((totalHours / totalFasts).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/fasting/status error:", error);
    return NextResponse.json({ error: "Error al obtener estado de ayuno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      protocol,
      targetFastHours,
      targetEatingHours,
      waterGoalMl,
      notifyFastStart,
      notifyFastEnd,
      notifyWaterReminders,
      startTimePreference,
    } = body;

    const updatedConfig = await prisma.fastingConfig.upsert({
      where: { userId: authResult.userId },
      update: {
        ...(protocol && { protocol }),
        ...(targetFastHours !== undefined && { targetFastHours }),
        ...(targetEatingHours !== undefined && { targetEatingHours }),
        ...(waterGoalMl !== undefined && { waterGoalMl }),
        ...(notifyFastStart !== undefined && { notifyFastStart }),
        ...(notifyFastEnd !== undefined && { notifyFastEnd }),
        ...(notifyWaterReminders !== undefined && { notifyWaterReminders }),
        ...(startTimePreference && { startTimePreference }),
      },
      create: {
        userId: authResult.userId,
        protocol: protocol || "16:8",
        targetFastHours: targetFastHours || 16,
        targetEatingHours: targetEatingHours || 8,
        waterGoalMl: waterGoalMl || 2500,
        notifyFastStart: notifyFastStart ?? true,
        notifyFastEnd: notifyFastEnd ?? true,
        notifyWaterReminders: notifyWaterReminders ?? true,
        startTimePreference: startTimePreference || "20:00",
      },
    });

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error("POST /api/v1/fasting/status error:", error);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}

// Cancelar / eliminar el ayuno activo actual (reset a cero)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;

    const deleted = await prisma.fastingLog.deleteMany({
      where: { userId, endTime: null },
    });

    return NextResponse.json({ success: true, deletedCount: deleted.count });
  } catch (error) {
    console.error("DELETE /api/v1/fasting/status error:", error);
    return NextResponse.json({ error: "Error al cancelar el ayuno" }, { status: 500 });
  }
}

