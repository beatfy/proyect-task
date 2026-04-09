import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { notifyTaskWebhook } from "@/lib/webhook";
import { put } from "@vercel/blob";
import { cuid } from "@/lib/utils";

// ---- Tool definitions for function calling ----
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "task_create",
      description: "Crear una nueva tarea en el proyecto activo",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título de la tarea" },
          description: { type: "string", description: "Descripción (opcional)" },
          priority: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"], default: "NONE" },
          dueDate: { type: "string", description: "Fecha límite ISO 8601 (opcional)" },
          assigneeId: { type: "string", description: "ID del miembro a asignar (opcional)" },
          parentId: { type: "string", description: "ID de tarea padre para subtarea (opcional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_update",
      description: "Actualizar una tarea existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID de la tarea" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] },
          priority: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueDate: { type: "string" },
          assigneeId: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_delete",
      description: "Eliminar una tarea",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID de la tarea a eliminar" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_list",
      description: "Listar tareas del proyecto activo con filtros opcionales",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] },
          priority: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] },
          assigneeId: { type: "string" },
          search: { type: "string", description: "Buscar por texto en título/descripción" },
          limit: { type: "number", default: 10, maximum: 50 },
          parentId: { type: "string", description: "Filtrar subtareas de una tarea" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_move",
      description: "Mover una tarea a otro estado",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID de la tarea" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"], description: "Nuevo estado" },
        },
        required: ["id", "status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "project_summary",
      description: "Obtener resumen del proyecto: tareas por estado, deadlines próximos, actividad reciente",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "member_list",
      description: "Listar miembros del proyecto activo",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "member_assign",
      description: "Asignar una tarea a un miembro del proyecto. El memberId debe ser el userId del usuario (no el ID de ProjectMember). Usa member_list para obtener los userIds correctos.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          memberId: { type: "string", description: "userId del miembro (NO el ProjectMember ID). Obténlo de member_list." },
        },
        required: ["taskId", "memberId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "time_log",
      description: "Registrar tiempo trabajado en una tarea",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          hours: { type: "number", description: "Horas trabajadas" },
          description: { type: "string", description: "Descripción del trabajo" },
        },
        required: ["taskId", "hours"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "client_context",
      description: "OBTENER CONTEXTO DEL CLIENTE antes de crear contenido, posts, o tareas para un cliente. Devuelve info sobre el cliente: web, nicho, servicios, estrategia, tono de voz, etc. SIEMPRE consulta esto antes de actuar para un cliente.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "client_context_update",
      description: "ACTUALIZAR el contexto del cliente del proyecto activo. Usa esto cuando el usuario proporcione info sobre el cliente (nicho, servicios, estrategia, tono de voz, web, etc.) o pida actualizar el contexto.",
      parameters: {
        type: "object",
        properties: {
          context: { type: "string", description: "Nuevo contenido del contexto del cliente. Se sobreescribe completamente." },
        },
        required: ["context"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "project_create",
      description: "Crear un nuevo proyecto dentro de la organización activa",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del proyecto" },
          description: { type: "string" },
          organizationId: { type: "string", description: "ID de la organización" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_attachment",
      description: "Crear un archivo de texto y adjuntarlo a una tarea. Útil para guardar notas, resúmenes, contenido generado, etc. como archivo adjunto.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "ID de la tarea donde adjuntar el archivo" },
          content: { type: "string", description: "Contenido de texto del archivo" },
          filename: { type: "string", description: "Nombre del archivo (opcional, por defecto: nota-[taskId].txt)" },
          mimeType: { type: "string", description: "Tipo MIME del archivo (opcional, por defecto: text/plain)" },
        },
        required: ["taskId", "content"],
      },
    },
  },
];

// ---- Tool execution ----
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  projectId?: string,
  organizationId?: string
): Promise<unknown> {
  switch (name) {
    case "task_create": {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          id: crypto.randomUUID(),
          title: args.title as string,
          creatorId: userId,
          priority: (args.priority as string) || "NONE",
        };
        if (args.description) data.description = args.description;
        if (args.dueDate) data.dueDate = new Date(args.dueDate as string);
        if (args.assigneeId) data.assigneeId = args.assigneeId;
        if (args.parentId) data.parentId = args.parentId;
        if (projectId) data.projectId = projectId;

        const task = await prisma.task.create({ data });
        // Notify via webhook if assigned to someone
        if (data.assigneeId) {
          await notifyTaskWebhook({ id: task.id, title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate?.toISOString() || null, assigneeId: data.assigneeId, creatorId: userId });
        }
        return { success: true, task: { id: task.id, title: task.title, status: task.status } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al crear tarea: ${msg}` };
      }
    }

    case "task_update": {
      try {
        const { id, ...updates } = args;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (updates.title) data.title = updates.title;
        if (updates.description) data.description = updates.description;
        if (updates.status) data.status = updates.status;
        if (updates.priority) data.priority = updates.priority;
        if (updates.dueDate) data.dueDate = new Date(updates.dueDate as string);
        if (updates.assigneeId) data.assigneeId = updates.assigneeId;

        const task = await prisma.task.update({
          where: { id: id as string },
          data,
        });
        return { success: true, task: { id: task.id, title: task.title, status: task.status } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found") || msg.includes("does not exist"))
          return { error: `Tarea no encontrada (ID: ${args.id}). Verifica que el ID sea correcto.` };
        return { error: `Error al actualizar tarea: ${msg}` };
      }
    }

    case "task_delete": {
      try {
        await prisma.task.delete({ where: { id: args.id as string } });
        return { success: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found") || msg.includes("does not exist"))
          return { error: `Tarea no encontrada (ID: ${args.id}). Verifica que el ID sea correcto.` };
        return { error: `Error al eliminar tarea: ${msg}` };
      }
    }

    case "task_list": {
      // BUG 1 FIX: combine search OR with user filter using AND instead of overwriting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        OR: [
          { creatorId: userId },
          { assigneeId: userId },
          { taskAssignees: { some: { userId } } },
        ],
      };
      if (projectId) where.projectId = projectId;
      if (args.status) where.status = args.status;
      if (args.priority) where.priority = args.priority;
      if (args.assigneeId) where.assigneeId = args.assigneeId;
      if (args.parentId) where.parentId = args.parentId;
      if (args.search) {
        // Combine search OR with the existing user/project filter using AND
        const userFilter = where.OR;
        const searchFilter = [
          { title: { contains: args.search as string, mode: "insensitive" } },
          { description: { contains: args.search as string, mode: "insensitive" } },
        ];
        where.AND = [
          { OR: userFilter },
          { OR: searchFilter },
        ];
        delete where.OR;
      }

      const limit = (args.limit as number) || 10;
      const tasks = await prisma.task.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          parentId: true,
        },
      });
      return { tasks, count: tasks.length };
    }

    case "client_context": {
      if (!projectId) return { error: "No hay proyecto activo" };
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, clientContext: true },
      });
      if (!project) return { error: "Proyecto no encontrado" };
      if (!project.clientContext) return { context: "No hay información de contexto para este cliente aún." };
      return { client: project.name, context: project.clientContext };
    }

    // BUG 5 FIX: new tool to update client context
    case "client_context_update": {
      if (!projectId) return { error: "No hay proyecto activo" };
      const contextText = args.context as string;
      if (!contextText) return { error: "El parámetro 'context' es requerido" };
      try {
        const updated = await prisma.project.update({
          where: { id: projectId },
          data: { clientContext: contextText },
          select: { name: true, clientContext: true },
        });
        return { success: true, client: updated.name, context: updated.clientContext };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al actualizar contexto del cliente: ${msg}` };
      }
    }

    case "task_move": {
      try {
        const task = await prisma.task.update({
          where: { id: args.id as string },
          data: { status: args.status as string },
        });
        return { success: true, task: { id: task.id, title: task.title, status: task.status } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found") || msg.includes("does not exist"))
          return { error: `Tarea no encontrada (ID: ${args.id}). Verifica que el ID sea correcto.` };
        return { error: `Error al mover tarea: ${msg}` };
      }
    }

    case "project_summary": {
      if (!projectId) return { error: "No hay proyecto activo" };
      try {
        const [todo, inProgress, inReview, done, upcoming] = await Promise.all([
          prisma.task.count({ where: { projectId, status: "TODO" } }),
          prisma.task.count({ where: { projectId, status: "IN_PROGRESS" } }),
          prisma.task.count({ where: { projectId, status: "IN_REVIEW" } }),
          prisma.task.count({ where: { projectId, status: "DONE" } }),
          prisma.task.findMany({
            where: { projectId, dueDate: { gte: new Date() }, status: { not: "DONE" } },
            take: 5,
            orderBy: { dueDate: "asc" },
            select: { id: true, title: true, dueDate: true, priority: true },
          }),
        ]);
        return { total: todo + inProgress + inReview + done, byStatus: { TODO: todo, IN_PROGRESS: inProgress, IN_REVIEW: inReview, DONE: done }, upcomingDeadlines: upcoming };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al obtener resumen: ${msg}` };
      }
    }

    case "member_list": {
      if (!projectId) return { error: "No hay proyecto activo" };
      try {
        const members = await prisma.projectMember.findMany({
          where: { projectId },
          select: { id: true, userId: true, role: true, user: { select: { id: true, name: true, email: true } } },
        });
        return { members };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al listar miembros: ${msg}` };
      }
    }

    // BUG 3 FIX: resolve memberId — accept both userId and ProjectMember ID
    case "member_assign": {
      try {
        let resolvedUserId = args.memberId as string;
        // If the LLM passed a ProjectMember ID instead of a userId, resolve it
        const pm = await prisma.projectMember.findUnique({ where: { id: resolvedUserId } });
        if (pm) {
          resolvedUserId = pm.userId;
        }
        const task = await prisma.task.update({
          where: { id: args.taskId as string },
          data: { assigneeId: resolvedUserId },
        });
        return { success: true, task: { id: task.id, title: task.title } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found") || msg.includes("does not exist"))
          return { error: `Tarea o miembro no encontrado. Task ID: ${args.taskId}, Member ID: ${args.memberId}` };
        return { error: `Error al asignar miembro: ${msg}` };
      }
    }

    case "time_log": {
      try {
        const hours = args.hours as number;
        const entry = await prisma.timeEntry.create({
          data: {
            id: crypto.randomUUID(),
            taskId: args.taskId as string,
            userId,
            startTime: new Date(Date.now() - hours * 3600000),
            endTime: new Date(),
            duration: Math.round(hours * 3600),
            description: (args.description as string) || "",
          },
        });
        return { success: true, entry: { id: entry.id, hours } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("not found") || msg.includes("does not exist"))
          return { error: `Tarea no encontrada (ID: ${args.taskId}). Verifica que el ID sea correcto.` };
        return { error: `Error al registrar tiempo: ${msg}` };
      }
    }

    case "project_create": {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          name: args.name as string,
          createdById: userId,
        };
        if (args.description) data.description = args.description;
        if (args.organizationId || organizationId)
          data.organizationId = (args.organizationId as string) || organizationId;

        const project = await prisma.project.create({ data });
        // Add creator as member
        await prisma.projectMember.create({
          data: { id: crypto.randomUUID(), projectId: project.id, userId, role: "ADMIN" },
        });
        return { success: true, project: { id: project.id, name: project.name } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al crear proyecto: ${msg}` };
      }
    }

    case "task_attachment": {
      try {
        const taskId = args.taskId as string;
        const content = args.content as string;
        const mimeType = (args.mimeType as string) || "text/plain";
        const filename = (args.filename as string) || `nota-${taskId.slice(0, 8)}.txt`;

        // Verify task exists
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
          return { error: `Tarea ${taskId} no encontrada` };
        }

        // Create blob from text content
        const blob = new Blob([content], { type: mimeType });
        const timestamp = Date.now();
        const safeName = filename.replace(/[^\w.\- ]/g, "").substring(0, 100);
        const key = `task-attachments/${taskId}/${timestamp}-${Math.random().toString(36).slice(2)}-${safeName}`;

        const uploaded = await put(key, blob, { access: "private" });

        const attachment = await prisma.attachment.create({
          data: {
            id: cuid(),
            name: safeName,
            url: uploaded.url,
            type: "document",
            size: blob.size,
            taskId,
          },
        });

        return { success: true, attachment: { id: attachment.id, name: attachment.name, url: attachment.url } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al crear adjunto: ${msg}` };
      }
    }

    default:
      return { error: `Tool "${name}" no reconocida` };
  }
}

// ---- Build system prompt ----
async function buildSystemPrompt(
  userName: string,
  userId: string,
  projectName?: string,
  projectId?: string,
  orgName?: string,
  orgId?: string,
  taskList?: string,
  memberList?: string,
  knowledgeBase?: string
): Promise<string> {
  const currentDate = new Date().toISOString().split("T")[0];
  return `Eres Tasky, el asistente de IA de TaskX-2. Ayudas a gestionar proyectos, tareas y equipos de forma directa y eficiente.

## Identidad
- Nombre: Tasky
- Hablas en el idioma del usuario (detecta y adapta)
- Personalidad: directa, eficiente, sin relleno
- Si puedes hacer algo, lo haces. Si necesitas info, preguntas lo mínimo.

## Contexto actual
- Proyecto activo: ${projectName || "Ninguno"} (ID: ${projectId || "N/A"})
- Organización: ${orgName || "Ninguna"} (ID: ${orgId || "N/A"})
- Usuario: ${userName} (ID: ${userId})
- Fecha actual: ${currentDate}

## Reglas
- Ante un mensaje ambiguo, interpreta la intención más probable y actúa.
- Para crear tareas: si no se especifica prioridad, usa NONE. Si no se especifica estado, usa TODO.
- Para listar tareas: muestra máximo 10 y ofrece ver más.
- Nunca inventes IDs. Usa los datos del contexto.
- Si el usuario pide algo fuera de tu alcance, dile qué puede hacer y sugiere acción manual.
- Respuestas concisas. Máximo 3-4 líneas salvo que se pida detalle.
- Para acciones destructivas (eliminar), confirma brevemente antes.
- MUY IMPORTANTE: Para actualizar/mover/eliminar tareas, usa SIEMPRE el ID exacto del listado de tareas actual. NUNCA inventes IDs.
- Si generas contenido largo (resúmenes, textos, notas), usa task_attachment para guardarlo como archivo adjunto en la tarea correspondiente.
- ANTES DE CREAR CONTENIDO (posts, textos, imágenes, emails, copys) para un cliente, usa la tool client_context para obtener información del cliente. Siempre adapta el contenido al nicho, tono y estrategia del cliente.
- Si el usuario menciona un cliente por nombre y no coincide con el proyecto activo, avísale.
- Cuando el usuario proporcione información sobre un cliente (nicho, servicios, tono, web, etc.), usa client_context_update para guardarla.

## Tareas del proyecto actual
${taskList || "Sin proyecto activo."}

## Miembros del proyecto
${memberList || "Sin proyecto activo."}

${knowledgeBase ? `## Base de conocimiento de la organización
${knowledgeBase}` : ""}`;
}

// ---- GET: chat history ----
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const messages = await prisma.chatMessage.findMany({
      where: { userId: authResult.userId, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true, projectId: true },
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}

// ---- POST: main handler ----
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { message, projectId, organizationId, history } = body as {
      message: string;
      projectId?: string;
      organizationId?: string;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
    }

    // Load context
    let projectName: string | undefined;
    let orgName: string | undefined;

    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, organizationId: true },
      });
      if (project) {
        projectName = project.name;
        if (project.organizationId) {
          const org = await prisma.organization.findUnique({
            where: { id: project.organizationId },
            select: { name: true },
          });
          orgName = org?.name;
        }
      }
    }

    // Get user name
    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { name: true },
    });

    // Load project tasks and members for context
    let taskList = "Sin proyecto activo.";
    let memberList = "Sin proyecto activo.";

    if (projectId) {
      const tasks = await prisma.task.findMany({
        where: { projectId },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, assigneeId: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      taskList = tasks.map(t => `- [${t.id}] "${t.title}" | ${t.status} | ${t.priority} | vence: ${t.dueDate?.toISOString().split("T")[0] || "sin fecha"}`).join("\n") || "No hay tareas.";

      const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true, role: true, user: { select: { name: true, email: true } } },
      });
      memberList = members.map(m => `- [${m.userId}] ${m.user?.name || m.user?.email} (${m.role})`).join("\n") || "No hay miembros.";
    }

    // Fetch organization knowledge base
    let knowledgeBase: string | undefined;
    if (organizationId) {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { organizationId },
      });
      if (kb?.content) {
        knowledgeBase = kb.content;
      }
    }

    const systemPrompt = await buildSystemPrompt(
      user?.name || "Usuario",
      authResult.userId,
      projectName,
      projectId,
      orgName,
      organizationId,
      taskList,
      memberList,
      knowledgeBase
    );

    // Build messages for OpenAI
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add history (max 20 messages)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      messages.push(...recentHistory);
    }

    messages.push({ role: "user", content: message });

    // Save user message
    await prisma.chatMessage.create({ data: { userId: authResult.userId, projectId: projectId || null, role: "user", content: message } });

    // Call LLM (GLM via OpenAI-compatible API)
    const apiKey = process.env.GLM_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key no configurada (GLM_API_KEY o OPENAI_API_KEY)" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.GLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.CHAT_MODEL || "glm-4.5-air";

    // First call — may return tool calls
    const firstResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!firstResponse.ok) {
      const err = await firstResponse.text();
      console.error("LLM API error:", err);
      return NextResponse.json({ error: "Error del modelo de IA" }, { status: 502 });
    }

    const firstData = await firstResponse.json();
    console.log(`[Tasky] LLM response:`, JSON.stringify(firstData.choices?.[0]?.message || {}).substring(0, 300));
    const choice = firstData.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls, return directly
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const reply = assistantMessage.content || "";
      await prisma.chatMessage.create({ data: { userId: authResult.userId, projectId: projectId || null, role: "assistant", content: reply } });
      return NextResponse.json({ reply, actions: [] });
    }

    // Execute tool calls
    const actions: Array<{ tool: string; result: unknown }> = [];
    const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, unknown>;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }

      console.log(`[Tasky] Tool call: ${toolName}`, JSON.stringify(toolArgs));

      const result = await executeTool(
        toolName,
        toolArgs,
        authResult.userId,
        projectId,
        organizationId
      );

      console.log(`[Tasky] Tool result:`, JSON.stringify(result).substring(0, 200));
      actions.push({ tool: toolName, result });
      toolResults.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Second call with tool results
    const secondMessages = [
      ...messages,
      assistantMessage,
      ...toolResults,
    ];

    const secondResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: secondMessages,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!secondResponse.ok) {
      // Return tool results with a fallback message
      return NextResponse.json({
        reply: "Acción completada.",
        actions,
      });
    }

    const secondData = await secondResponse.json();
    const finalReply = secondData.choices[0]?.message?.content || "Acción completada.";

    await prisma.chatMessage.create({ data: { userId: authResult.userId, projectId: projectId || null, role: "assistant", content: finalReply } });

    return NextResponse.json({ reply: finalReply, actions });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: `Error interno: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
