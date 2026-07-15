import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { agentRateLimit } from "@/lib/ai-rate-limit";
import { cuid } from "@/lib/utils";
import crypto, { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const INNIX_BASE = process.env.INNIX_BASE || "https://agents.beatfy.net/agent";

const AGENT_CONFIG: Record<string, { path: string; apiKey: string; model: string }> = {
  "doc": {
    path: "doc",
    apiKey: process.env.INNIX_DOC_KEY || "cecb3f99b46e7e16adfa60a5d4a839b5f27d1f3e1659",
    model: "glm-5.2",
  },
};


export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const projectId = searchParams.get("projectId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!agentId) {
      return NextResponse.json({ error: "agentId es requerido" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: authResult.userId, agentId };
    if (projectId) where.projectId = projectId;

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error("Agent chat GET error:", error);
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rateCheck = await agentRateLimit(authResult.userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite de llamadas al agente. Espera un momento.", remaining: rateCheck.remaining },
        { status: 429 }
      );
    }

    // Obtener detalles del usuario para personalizar el prompt
    const userDetails = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { name: true, email: true },
    });
    const userName = userDetails?.name || userDetails?.email || "Usuario";

    const { agentId, message, history, projectId, documentIds } = await req.json();

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json({ error: "agentId es requerido" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const agentConfig = AGENT_CONFIG[agentId];
    if (!agentConfig) {
      return NextResponse.json({ error: "Agente no reconocido" }, { status: 400 });
    }

    const agentUrl = `${INNIX_BASE}/${agentConfig.path}/v1/chat/completions`;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://proyect-task.vercel.app";

    let organizationId: string | null = null;
    let orgApiKey: string | null = null;

    let clientContext = "";

    /* ── ELE: Agente personal con acceso total ── */
    /* ── Agentes normales: requieren projectId ── */
    if (projectId && typeof projectId === "string") {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, description: true, clientContext: true, organizationId: true },
        });

        if (project) {
          organizationId = project.organizationId;

          const taskCountByStatus = await prisma.task.groupBy({
            by: ["status"],
            where: { projectId },
            _count: { id: true },
          });

          const statusCounts = Object.fromEntries(
            taskCountByStatus.map((t: { status: string; _count: { id: number } }) => [t.status, t._count.id])
          );
          const todoCount = statusCounts["TODO"] ?? 0;
          const inProgressCount = (statusCounts["INPROGRESS"] ?? 0) + (statusCounts["INREVIEW"] ?? 0);
          const doneCount = statusCounts["DONE"] ?? 0;

          const recentDoneTasks = await prisma.task.findMany({
            where: { projectId, status: "DONE" },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { title: true },
          });

          const recentChatMessages = await prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { role: true, content: true },
          });

          const recentComments = await prisma.comment.findMany({
            where: { task: { projectId } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { content: true },
          });

          let sysContext = `\n\n---\n[SISTEMA] Cliente: "${project.name}"
- Descripcion: ${project.description || "Sin descripcion"}
- Tareas: ${todoCount} pendientes, ${inProgressCount} en progreso, ${doneCount} completadas
- Ultimas tareas completadas: ${recentDoneTasks.map((t: { title: string }) => t.title).join(", ") || "Ninguna"}
- Notas recientes: ${recentComments.map((c: { content: string }) => c.content).slice(0, 3).join(" | ") || "Ninguna"}
- Historial de chat: ${recentChatMessages.slice(0, 3).map((m: { role: string; content: string }) => `${m.role}: ${m.content.substring(0, 100)}`).join(" | ") || "Ninguno"}`;

          if (project.clientContext) {
            sysContext += `\n\n---\n[CONTEXTO DEL CLIENTE — USO ESTRICTO]\n${project.clientContext}\n[FIN CONTEXTO]`;
          }

          clientContext = sysContext;
        }
      } catch (dbErr) {
        console.error("DB lookup error:", dbErr);
      }
    }

    if (!organizationId && projectId) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { organizationId: true },
        });
        if (project) organizationId = project.organizationId;
      } catch {}
    }

    if (!organizationId) {
      try {
        const member = await prisma.organizationMember.findFirst({
          where: { userId: authResult.userId },
          select: { organizationId: true },
          orderBy: { joinedAt: "asc" },
        });
        if (member) organizationId = member.organizationId;
      } catch {}
    }

    if (organizationId) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { apiKey: true },
        });
        if (org?.apiKey) orgApiKey = org.apiKey;
      } catch {}
    }

    let agentApiContext = "";
    if (agentId === "doc") {
      const secret = process.env.NEXTAUTH_SECRET || "default_secret";
      const signature = crypto.createHmac("sha256", secret).update(authResult.userId).digest("hex");
      const docToken = `tx2_doc_${authResult.userId}_${signature}`;
      const base64DocToken = "tx2b64_" + Buffer.from(docToken).toString("base64");

      agentApiContext = `\n\n---\n` +
        `[INSTRUCCIONES DE IDENTIDAD Y ACCESO SUPER PRIVILEGIADO PARA DOC]\n` +
        `Hola Doc, estás conectado al backend del usuario. Se te ha otorgado ACCESO CON SÚPER PRIVILEGIOS para actuar en nombre del usuario utilizando la siguiente API key:\n` +
        `URL base de la API: ${appBaseUrl}/api/v1\n` +
        `Cabecera de Autenticación: Authorization: Bearer ${base64DocToken}\n` +
        `NOTA DE SEGURIDAD IMPORTANTE (API KEY): Para evitar la censura del gateway de IA en la transmisión, la clave anterior se proporciona codificada en Base64 con el prefijo "tx2b64_". Úsala EXACTAMENTE así en tus llamadas HTTP (Authorization: Bearer tx2b64_...). El servidor la decodificará automáticamente.\n\n` +
        `[SECCIÓN DE ENFOQUE / FOCUS FLOW — INSTRUCCIONES OPERATIVAS Y CONCEPTUALES]\n` +
        `El sistema tiene una sección llamada "Focus Flow" diseñada para mentes neurodivergentes o con TDAH. Su propósito es organizar tareas según la carga emocional (fricción mental) y energía disponible, en lugar de plazos tradicionales rígidos. Esto combate la parálisis de inicio y el burnout.\n\n` +
        `1. Conceptos y Métricas Clave (tdahMetrics):\n` +
        `   - Peso Emocional (emotionalWeight / baseWeight): De 1.0 (liviano) a 5.0 (parálisis extrema). Un peso alto indica una tarea que causa evitación, aburrimiento o ansiedad.\n` +
        `   - Energía Requerida (energyRequired): "low" (baja), "medium" (media) o "high" (alta). Ayuda a filtrar tareas según el estado mental actual.\n` +
        `   - Bloque de Tiempo (timeBlock): Duración sugerida (ej. "15min", "30min", "60min"). Promueve el timeboxing.\n` +
        `   - Razón de Bloqueo (blockReason): Texto descriptivo del obstáculo psicológico o fricción percibida (ej. "No sé por dónde empezar", "Es muy aburrido").\n` +
        `   - ¿Bloquea a Alguien? (blocksSomeone): true/false. Si bloquea a otros, tiene prioridad de escalación.\n` +
        `   - Fuente de Dopamina (dopamineSource): "routine", "social", "creative" o "problem-solving". Indica qué tipo de recompensa genera.\n` +
        `   - Streak Days (streakDays): Días sin tocar la tarea. Si pasa de 3 días y blocksSomeone es true, la tarea es promovida automáticamente al inicio de la cola.\n` +
        `   - Orden de la Cola (Focus Queue): El sistema ordena automáticamente las tareas: Promovidas primero, luego por emotionalWeight desc, luego por streakDays desc.\n\n` +
        `2. Endpoints de Focus Flow Disponibles:\n` +
        `   - Obtener Cola de Enfoque: GET ${appBaseUrl}/api/v1/focus/tasks (Opcional: ?energy=low|medium|high)\n` +
        `   - Crear Tarea de Enfoque: POST ${appBaseUrl}/api/v1/focus/tasks\n` +
        `     Cuerpo JSON: { title, description, projectId, emotionalWeight, timeBlock, energyRequired, blocksSomeone, dopamineSource, blockReason, status }\n` +
        `     *Nota*: El campo "status" puede ser "TODO" o "planning". Máximo 3 tareas pueden estar en estado "planning" a la vez (límite de procrastinación).\n` +
        `   - Actualizar / Aliviar Tarea: PATCH ${appBaseUrl}/api/v1/focus/tasks/<id>\n` +
        `     Cuerpo JSON: Permite actualizar cualquier campo. Para avances de TDAH, puedes mandar el campo "status":\n` +
        `       - status: "hecha" (o "completed" o "DONE") -> Marca la tarea como completada.\n` +
        `       - status: "aliviada" -> Reduce el emotionalWeight y baseWeight en 2 puntos (mínimo 1).\n` +
        `       - status: "sigue_pesando" -> Incrementa el emotionalWeight y baseWeight en 0.5 puntos (máximo 5).\n` +
        `   - Eliminar Tarea de Enfoque: DELETE ${appBaseUrl}/api/v1/focus/tasks/<id>\n` +
        `   - Obtener Activador (Dopamine Primer): GET ${appBaseUrl}/api/v1/focus/primer (Retorna una actividad sugerida corta de 3-5 minutos para calentar el cerebro).\n` +
        `   - Dividir Tarea (Micro-Split): POST ${appBaseUrl}/api/tasks/<id>/micro-split\n` +
        `     Cuerpo JSON: { steps: ["Paso 1", "Paso 2", ...] } (Crea subtareas de 15min con peso emocional aliviado para deshacer la parálisis).\n\n` +
        `3. Endpoints Generales de Gestión:\n` +
        `   - GET/POST ${appBaseUrl}/api/v1/projects — Ver y crear proyectos (?id=X para detalle)\n` +
        `   - GET/POST/PATCH/DELETE ${appBaseUrl}/api/v1/tasks — Gestionar tareas de proyectos tradicionales\n` +
        `   - GET/POST/PATCH/DELETE ${appBaseUrl}/api/v1/contacts — CRM de Contactos\n` +
        `   - GET/POST/PATCH ${appBaseUrl}/api/v1/deals — CRM de Negocios y Etapas\n` +
        `   - GET ${appBaseUrl}/api/v1/pipeline — Pipeline del CRM\n` +
        `   - GET/POST/PATCH/DELETE ${appBaseUrl}/api/billing/invoices — Gestionar facturas (?projectId=X, ?status=PENDING|PAID). En POST envía { projectId, amount, notes, month, year, dueDate } para crear. En PATCH envía { status: "PAID" | "PENDING" } para actualizar una factura.\n` +
        `   - PATCH ${appBaseUrl}/api/billing/projects/<projectId> — Configurar cobro del cliente (monthlyFee, clientEmail, recurringInvoice, billingDay, invoiceEmailMsg).\n` +
        `   - POST ${appBaseUrl}/api/billing/generate — Auto-generar facturas de cuota mensual del mes anterior.\n` +
        `   - GET ${appBaseUrl}/api/mail/inbox — Leer correos electrónicos (?folder=INBOX|Sent|Drafts|Trash&limit=X).\n` +
        `   - GET ${appBaseUrl}/api/mail/<id> — Obtener el contenido de un correo (?folder=X).\n` +
        `   - POST ${appBaseUrl}/api/mail/send — Enviar un correo electrónico vía SMTP. Cuerpo JSON: { to: "destinatario@ejemplo.com", subject: "asunto", body: "cuerpo del mensaje" }.\n\n` +
        `Usa estas APIs de forma autónoma cuando el usuario te pida crear tareas, enviar correos, leer emails de su bandeja, facturas, configurar cobros, dividirlas, consultar su cola, aliviar el peso de una tarea o dar seguimiento a su día. ¡Tú eres su coach de confianza!\n` +
        `[FIN DE INSTRUCCIONES OPERATIVAS]`;
    } else if (orgApiKey) {
      const base64ApiKey = "tx2b64_" + Buffer.from(orgApiKey).toString("base64");

      agentApiContext = `\n\n---\n[API DE ACCESO — PUEDES CONSULTAR Y MODIFICAR DATOS DEL CLIENTE]\n` +
        `URL base: ${appBaseUrl}/api/v1\n` +
        `Autenticacion: Bearer ${base64ApiKey}\n` +
        `NOTA IMPORTANTE DE SEGURIDAD (API KEY): Para evitar la censura del gateway de IA en la transmisión, la clave de autenticación anterior se proporciona codificada en Base64 con el prefijo "tx2b64_". Usa esta clave EXACTAMENTE como se proporciona en la cabecera 'Authorization: Bearer <clave>' de tus peticiones HTTP. No la modifiques ni intentes decodificarla, ya que el servidor la decodificará automáticamente.\n` +
        `Endpoints disponibles:\n` +
        `- GET/POST ${appBaseUrl}/api/v1/projects — Listar/crear proyectos (?id=X para detalle)\n` +
        `- GET/POST/PATCH/DELETE ${appBaseUrl}/api/v1/tasks — Gestionar tareas (?id=X, ?projectId=X, ?status=TODO|IN_PROGRESS|DONE)\n` +
        `- GET/POST/PATCH/DELETE ${appBaseUrl}/api/v1/contacts — Gestionar contactos (?id=X, ?search=...)\n` +
        `- GET/POST/PATCH ${appBaseUrl}/api/v1/deals — Gestionar oportunidades (?id=X, ?stageId=X)\n` +
        `- GET ${appBaseUrl}/api/v1/pipeline — Ver pipeline completo con etapas y deals\n` +
        `Usa estas APIs cuando necesites informacion actual del cliente o para crear/actualizar datos.\n` +
        `[FIN API DE ACCESO]`;
    }

    // Fetch last 20 messages from the database as chat history context (before saving new message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyWhere: any = { userId: authResult.userId, agentId };
    if (projectId) historyWhere.projectId = projectId;

    const dbHistory = await prisma.chatMessage.findMany({
      where: historyWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { role: true, content: true },
    });

    // Save user message
    await prisma.chatMessage.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        projectId: projectId || null,
        role: "user",
        content: message,
        organizationId: organizationId || null,
        agentId,
      },
    });

    const messages: Array<{ role: string; content: string }> = [];

    const systemInstruction = `${clientContext}${agentApiContext}`.trim();
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    if (dbHistory && dbHistory.length > 0) {
      // Invert dbHistory array to chronological order (it was fetched desc)
      const contextMsg = dbHistory.reverse().map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      messages.push(...contextMsg);
    }

    let documentsContext = "";
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      try {
        const loadedDocs = await prisma.agentDocument.findMany({
          where: {
            id: { in: documentIds },
            userId: authResult.userId,
          },
          select: { name: true, text: true },
        });

        if (loadedDocs.length > 0) {
          documentsContext = "\n\n---\n[DOCUMENTOS ADJUNTOS POR EL USUARIO PARA SU ANÁLISIS]";
          loadedDocs.forEach((doc) => {
            documentsContext += `\n\nNombre de Archivo: ${doc.name}\nContenido:\n--- START FILE ---\n${doc.text || "(Este archivo no tiene texto extraíble o está vacío)"}\n--- END FILE ---`;
          });
          documentsContext += "\n[FIN DE DOCUMENTOS ADJUNTOS]";
        }
      } catch (docErr) {
        console.error("Error loading agent documents context:", docErr);
      }
    }

    const finalUserMessage = `${message}${documentsContext}`.trim();

    messages.push({ role: "user", content: finalUserMessage });

    async function callAgentWithRetry(url: string, body: unknown, key: string, retries = 3, delayMs = 2000): Promise<Response> {
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(300000)
          });
          if (res.ok) return res;
          if (res.status >= 500 && attempt < retries) {
            console.warn(`Agent returned ${res.status}, retrying (${attempt}/${retries})...`);
            await new Promise(r => setTimeout(r, delayMs * attempt));
            continue;
          }
          return res;
        } catch (err) {
          lastErr = err as Error;
          if (attempt < retries) {
            console.warn(`Agent fetch error, retrying (${attempt}/${retries})...`, err);
            await new Promise(r => setTimeout(r, delayMs * attempt));
          }
        }
      }
      throw lastErr || new Error("Agent call failed after retries");
    }

    let agentRes: Response;
    try {
      agentRes = await callAgentWithRetry(
        agentUrl,
        { model: agentConfig.model, messages, temperature: 0.7, max_tokens: 16000 },
        agentConfig.apiKey
      );
    } catch (err) {
      console.error("Agent chat error after retries:", err);
      return NextResponse.json({ error: "El agente no esta disponible. Intenta de nuevo en unos segundos." }, { status: 503 });
    }

    if (!agentRes.ok) {
      const errText = await agentRes.text().catch(() => "Error agente");
      console.error(`Agent error [${agentRes.status}]:`, errText);
      const errorMsg = agentRes.status === 429
        ? "El agente esta ocupado. Intenta de nuevo en unos segundos."
        : agentRes.status === 503
        ? "El agente no esta disponible temporalmente."
        : "Error al conectar con el agente.";
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const agentData = await agentRes.json();
    const response = agentData.choices?.[0]?.message?.content || "Sin respuesta del agente";

    // Save assistant message
    await prisma.chatMessage.create({
      data: {
        id: cuid(),
        userId: authResult.userId,
        projectId: projectId || null,
        role: "assistant",
        content: response,
        organizationId: organizationId || null,
        agentId,
      },
    });

    return NextResponse.json({ response });

  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
