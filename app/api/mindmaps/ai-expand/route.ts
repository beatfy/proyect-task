import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { aiRateLimit } from "@/lib/ai-rate-limit";

interface ExpandedBranch {
  label: string;
  desc: string;
  color: "indigo" | "amber" | "emerald" | "blue" | "rose" | "purple";
  checklist?: { id: string; text: string; completed: boolean }[];
}

function buildContextualFallbackBranches(
  nodeLabel: string,
  nodeDescription?: string,
  mapTitle?: string
): ExpandedBranch[] {
  const cleanLabel = nodeLabel.trim() || "Nodo principal";
  const now = Date.now();
  return [
    {
      label: `Objetivos: ${cleanLabel}`,
      desc: `Metas medibles y entregables clave para ${cleanLabel}${mapTitle ? ` en ${mapTitle}` : ""}`,
      color: "indigo",
      checklist: [
        { id: `c-${now}-1`, text: `Definir alcance de ${cleanLabel}`, completed: false },
        { id: `c-${now}-2`, text: "Validar criterios de éxito", completed: false },
      ],
    },
    {
      label: `Plan de Acción: ${cleanLabel}`,
      desc: nodeDescription
        ? `Pasos prácticos basados en: ${nodeDescription.slice(0, 80)}`
        : `Secuencia de implementación y responsables para ${cleanLabel}`,
      color: "emerald",
      checklist: [
        { id: `c-${now}-3`, text: "Asignar responsable principal", completed: false },
        { id: `c-${now}-4`, text: "Establecer fecha de primera revisión", completed: false },
      ],
    },
    {
      label: `Riesgos y Bloqueos`,
      desc: `Dependencias críticas y plan de contingencia para ${cleanLabel}`,
      color: "amber",
    },
    {
      label: `Recursos y Métricas`,
      desc: `Herramientas necesarias y KPIs de seguimiento para ${cleanLabel}`,
      color: "blue",
    },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rateCheck = await aiRateLimit(authResult.userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes de IA. Intenta de nuevo en un minuto." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const nodeLabel = typeof body.nodeLabel === "string" ? body.nodeLabel.trim() : "";
    const nodeDescription = typeof body.nodeDescription === "string" ? body.nodeDescription.trim() : "";
    const mapTitle = typeof body.mapTitle === "string" ? body.mapTitle.trim() : "";
    const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";

    if (!nodeLabel) {
      return NextResponse.json({ error: "El nombre del nodo es obligatorio" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    if (apiKey) {
      try {
        const prompt = [
          `Eres un experto en gestión de proyectos y mapas mentales.`,
          `Genera exactamente 4 sub-nodos accionables en formato JSON para expandir el nodo "${nodeLabel}".`,
          mapTitle ? `Título del mapa mental: "${mapTitle}".` : "",
          projectName ? `Proyecto asociado: "${projectName}".` : "",
          nodeDescription ? `Descripción del nodo: "${nodeDescription}".` : "",
          `Responde ÚNICAMENTE con un objeto JSON válido con la propiedad "branches", donde cada elemento tenga:`,
          `{ "label": "string corto (máx 40 caracteres)", "desc": "string descriptivo (máx 100 caracteres)", "color": "indigo" | "amber" | "emerald" | "blue", "checklist": ["tarea 1", "tarea 2"] }`,
        ]
          .filter(Boolean)
          .join("\n");

        const llmRes = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const content = llmData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.branches) && parsed.branches.length > 0) {
              const validColors = ["indigo", "amber", "emerald", "blue", "rose", "purple"] as const;
              const now = Date.now();
              const branches: ExpandedBranch[] = parsed.branches.slice(0, 4).map((b: Record<string, unknown>, idx: number) => ({
                label: String(b.label || `Sub-rama ${idx + 1}`).slice(0, 60),
                desc: String(b.desc || "").slice(0, 160),
                color: validColors.includes(b.color as typeof validColors[number])
                  ? (b.color as ExpandedBranch["color"])
                  : validColors[idx % validColors.length],
                checklist: Array.isArray(b.checklist)
                  ? b.checklist.slice(0, 3).map((item: unknown, cIdx: number) => ({
                      id: `c-${now}-${idx}-${cIdx}`,
                      text: String(item),
                      completed: false,
                    }))
                  : undefined,
              }));

              return NextResponse.json({ branches, source: "ai" });
            }
          }
        }
      } catch (aiErr) {
        console.warn("AI mindmap expansion fallback triggered:", aiErr);
      }
    }

    const fallbackBranches = buildContextualFallbackBranches(nodeLabel, nodeDescription, mapTitle);
    return NextResponse.json({ branches: fallbackBranches, source: "contextual" });
  } catch (error) {
    console.error("Error in mindmap ai-expand:", error);
    return NextResponse.json({ error: "Error al generar ramas" }, { status: 500 });
  }
}
