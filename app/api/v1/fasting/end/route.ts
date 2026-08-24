import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { cuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

function evaluateFastBreakerMeal(mealText: string): string {
  const text = mealText.toLowerCase();
  const cautions = ["azucar", "azúcar", "pizza", "bolleria", "bollería", "dulce", "pastel", "refresco", "coca", "fritura", "pan blanco", "galleta", "pasta blanca", "chucherias", "helado"];
  const excellents = ["huevo", "huevos", "aguacate", "pollo", "pescado", "salmon", "salmón", "atun", "atún", "ensalada", "verdura", "caldo", "frutos secos", "nueces", "almendras", "aceite de oliva", "chia", "espinaca", "brocoli", "brócoli", "tofu", "carne"];

  const hasCaution = cautions.some((w) => text.includes(w));
  const hasExcellent = excellents.some((w) => text.includes(w));

  if (hasCaution && !hasExcellent) {
    return "⚠️ Precaución: Alimentos de alto índice glucémico pueden generar un pico de insulina brusco y fatiga tras el ayuno. Hidrátate y añade fibra en tu próxima comida.";
  } else if (hasExcellent) {
    return "✨ Excelente elección: Proteínas y grasas saludables ideales para una transición metabólica suave y sostenida sin picos de glucosa.";
  } else {
    return "👍 Buena comida para romper el ayuno. Recuerda masticar despacio y mantenerte bien hidratado.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = authResult.userId;
    const body = await req.json().catch(() => ({}));
    const { feeling, notes, discard, firstMeal, energyLevel, clarityLevel, hungerLevel } = body;

    const activeFast = await prisma.fastingLog.findFirst({
      where: { userId, endTime: null },
      orderBy: { startTime: "desc" },
    });

    if (!activeFast) {
      return NextResponse.json({ error: "No hay ningún ayuno activo para finalizar" }, { status: 404 });
    }

    if (discard) {
      // Si el usuario quiere descartar o resetear el ayuno a cero sin guardarlo
      await prisma.fastingLog.delete({
        where: { id: activeFast.id },
      });
      return NextResponse.json({ success: true, discarded: true, message: "Ayuno descartado correctamente" });
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(activeFast.startTime).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const targetHours = activeFast.targetHours || 16;
    const completedGoal = elapsedHours >= targetHours * 0.9; // Considerado completado si alcanza el 90% o más del objetivo

    const firstMealEvaluation = firstMeal && firstMeal.trim() ? evaluateFastBreakerMeal(firstMeal.trim()) : null;

    const updatedFast = await prisma.fastingLog.update({
      where: { id: activeFast.id },
      data: {
        endTime: now,
        completed: completedGoal,
        feeling: feeling || "good",
        notes: notes || null,
        firstMeal: firstMeal && firstMeal.trim() ? firstMeal.trim() : null,
        firstMealEvaluation,
        energyLevel: energyLevel ? Number(energyLevel) : null,
        clarityLevel: clarityLevel ? Number(clarityLevel) : null,
        hungerLevel: hungerLevel ? Number(hungerLevel) : null,
      },
    });

    const config = await prisma.fastingConfig.findUnique({ where: { userId } });
    if (config?.notifyFastEnd) {
      await prisma.notification.create({
        data: {
          id: cuid(),
          userId,
          type: "FASTING_END",
          title: completedGoal ? "🎉 ¡Ayuno Completado con Éxito!" : "🏁 Ayuno Finalizado",
          content: `Has ayunado ${elapsedHours.toFixed(1)} horas. ¡Buen trabajo! Recuerda romper tu ayuno con proteína magra y vegetales.`,
          data: { fastId: activeFast.id, elapsedHours, completedGoal },
        },
      }).catch((e) => console.error("Error creating notification:", e));
    }

    return NextResponse.json({ success: true, fast: updatedFast, elapsedHours, completedGoal });
  } catch (error) {
    console.error("POST /api/v1/fasting/end error:", error);
    return NextResponse.json({ error: "Error al finalizar el ayuno" }, { status: 500 });
  }
}
