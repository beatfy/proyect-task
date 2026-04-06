import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
      description: "Asignar una tarea a un miembro del proyecto",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          memberId: { type: "string", description: "ID del miembro" },
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
      const data: Record<string, unknown> = {
        title: args.title as string,
        creatorId: userId,
      };
      if (args.description) data.description = args.description;
      if (args.priority) data.priority = args.priority;
      else data.priority = "NONE";
      if (args.dueDate) data.dueDate = new Date(args.dueDate as string);
      if (args.assigneeId) data.assigneeId = args.assigneeId;
      if (args.parentId) data.parentId = args.parentId;
      if (projectId) data.projectId = projectId;

      const task = await prisma.task.create({ data });
      return { success: true, task: { id: task.id, title: task.title, status: task.status } };
    }

    case "task_update": {
      const { id, ...updates } = args;
      const data: Record<string, unknown> = {};
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
    }

    case "task_delete": {
      await prisma.task.delete({ where: { id: args.id as string } });
      return { success: true };
    }

    case "task_list": {
      const where: Record<string, unknown> = {
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
        where.OR = [
          { title: { contains: args.search as string, mode: "insensitive" } },
          { description: { contains: args.search as string, mode: "insensitive" } },
        ];
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

    case "task_move": {
      const task = await prisma.task.update({
        where: { id: args.id as string },
        data: { status: args.status },
      });
      return { success: true, task: { id: task.id, title: task.title, status: task.status } };
    }

    case "project_summary": {
      if (!projectId) return { error: "No hay proyecto activo" };
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
    }

    case "member_list": {
      if (!projectId) return { error: "No hay proyecto activo" };
      const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { id: true, userId: true, role: true, user: { select: { id: true, name: true, email: true } } },
      });
      return { members };
    }

    case "member_assign": {
      const task = await prisma.task.update({
        where: { id: args.taskId as string },
        data: { assigneeId: args.memberId as string },
      });
      return { success: true, task: { id: task.id, title: task.title } };
    }

    case "time_log": {
      const entry = await prisma.timeEntry.create({
        data: {
          taskId: args.taskId as string,
          userId,
          hours: args.hours as number,
          description: (args.description as string) || "",
        },
      });
      return { success: true, entry: { id: entry.id, hours: entry.hours } };
    }

    case "project_create": {
      const data: Record<string, unknown> = {
        name: args.name as string,
        createdById: userId,
      };
      if (args.description) data.description = args.description;
      if (args.organizationId || organizationId)
        data.organizationId = (args.organizationId as string) || organizationId;

      const project = await prisma.project.create({ data });
      // Add creator as member
      await prisma.projectMember.create({
        data: { projectId: project.id, userId, role: "ADMIN" },
      });
      return { success: true, project: { id: project.id, name: project.name } };
    }

    default:
      return { error: `Tool "${name}" no reconocida` };
  }
}

// ---- Build system prompt ----
function buildSystemPrompt(
  userName: string,
  userId: string,
  projectName?: string,
  projectId?: string,
  orgName?: string,
  orgId?: string
): string {
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
- Para acciones destructivas (eliminar), confirma brevemente antes.`;
}

// ---- Main handler ----
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

    const systemPrompt = buildSystemPrompt(
      user?.name || "Usuario",
      authResult.userId,
      projectName,
      projectId,
      orgName,
      organizationId
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

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const model = process.env.CHAT_MODEL || "gpt-4o-mini";

    // First call — may return tool calls
    const firstResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!firstResponse.ok) {
      const err = await firstResponse.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ error: "Error del modelo de IA" }, { status: 502 });
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls, return directly
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return NextResponse.json({
        reply: assistantMessage.content || "",
        actions: [],
      });
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

      const result = await executeTool(
        toolName,
        toolArgs,
        authResult.userId,
        projectId,
        organizationId
      );

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

    const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: secondMessages,
        max_tokens: 1000,
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

    return NextResponse.json({
      reply: finalReply,
      actions,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
