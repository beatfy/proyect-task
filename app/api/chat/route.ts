import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { notifyTaskWebhook } from "@/lib/webhook";
import { put } from "@vercel/blob";
import { cuid } from "@/lib/utils";
import { estimateTokens, enforceTokenBudget } from "@/lib/token-budget";

export const dynamic = 'force-dynamic';

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
          status: { type: "string", enum: ["TODO", "INPROGRESS", "INREVIEW", "DONE"] },
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
          status: { type: "string", enum: ["TODO", "INPROGRESS", "INREVIEW", "DONE"], description: "Nuevo estado" },
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
  // ---- CRM Tools ----
  {
    type: "function" as const,
    function: {
      name: "contact_create",
      description: "Crear un nuevo contacto en el CRM de la organización activa",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del contacto" },
          email: { type: "string", description: "Email (opcional)" },
          phone: { type: "string", description: "Teléfono (opcional)" },
          company: { type: "string", description: "Empresa (opcional)" },
          notes: { type: "string", description: "Notas adicionales (opcional)" },
          tags: { type: "array", items: { type: "string" }, description: "Tags/etiquetas (opcional)" },
          status: { type: "string", enum: ["LEAD", "PROSPECT", "CLIENT", "CHURNED"], default: "LEAD" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "contact_list",
      description: "Listar contactos del CRM de la organización activa con filtros opcionales",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Buscar por nombre, email o empresa" },
          status: { type: "string", enum: ["LEAD", "PROSPECT", "CLIENT", "CHURNED"] },
          limit: { type: "number", default: 20, maximum: 50 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pipeline_list",
      description: "Listar pipelines y sus etapas del CRM de la organización activa",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deal_create",
      description: "Crear un nuevo deal/oportunidad en el pipeline del CRM. Requiere un contacto existente y una etapa del pipeline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del deal" },
          value: { type: "number", description: "Valor estimado del deal" },
          contactId: { type: "string", description: "ID del contacto asociado" },
          stageId: { type: "string", description: "ID de la etapa del pipeline" },
          probability: { type: "number", description: "Probabilidad de cierre 0-100 (opcional)" },
          expectedClose: { type: "string", description: "Fecha estimada de cierre ISO 8601 (opcional)" },
          notes: { type: "string", description: "Notas del deal (opcional)" },
        },
        required: ["title", "contactId", "stageId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deal_list",
      description: "Listar deals/oportunidades del CRM de la organización activa",
      parameters: {
        type: "object",
        properties: {
          stageId: { type: "string", description: "Filtrar por etapa del pipeline (opcional)" },
          limit: { type: "number", default: 20, maximum: 50 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deal_move",
      description: "Mover un deal/oportunidad a otra etapa del pipeline",
      parameters: {
        type: "object",
        properties: {
          dealId: { type: "string", description: "ID del deal" },
          stageId: { type: "string", description: "ID de la etapa destino" },
        },
        required: ["dealId", "stageId"],
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
  const canModify = async (taskId?: string): Promise<string | null> => {
    if (!projectId) return "No hay proyecto activo";
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!membership) return "No eres miembro de este proyecto";
    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
      if (!task || task.projectId !== projectId) return "Tarea no encontrada en este proyecto";
    }
    return null;
  };

  const requireOrg = (): string | null => {
    if (!organizationId) return "No hay organización activa. Se necesita una organización para usar el CRM.";
    return null;
  };

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
        const permErr = await canModify(args.id as string);
        if (permErr) return { error: permErr };
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
        const permErr = await canModify(args.id as string);
        if (permErr) return { error: permErr };
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (projectId) {
        where.projectId = projectId;
      } else if (organizationId) {
        where.project = { organizationId };
      } else {
        where.OR = [
          { creatorId: userId },
          { assigneeId: userId },
          { taskAssignees: { some: { userId } } },
        ];
      }
      if (args.status) where.status = args.status;
      if (args.priority) where.priority = args.priority;
      if (args.assigneeId) where.assigneeId = args.assigneeId;
      if (args.parentId) where.parentId = args.parentId;
      if (args.search) {
        const searchFilter = [
          { title: { contains: args.search as string, mode: "insensitive" } },
          { description: { contains: args.search as string, mode: "insensitive" } },
        ];
        if (where.OR) {
          const userFilter = where.OR;
          where.AND = [
            { OR: userFilter },
            { OR: searchFilter },
          ];
          delete where.OR;
        } else {
          where.OR = searchFilter;
        }
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
        const permErr = await canModify(args.id as string);
        if (permErr) return { error: permErr };
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
          prisma.task.count({ where: { projectId, status: "INPROGRESS" } }),
          prisma.task.count({ where: { projectId, status: "INREVIEW" } }),
          prisma.task.count({ where: { projectId, status: "DONE" } }),
          prisma.task.findMany({
            where: { projectId, dueDate: { gte: new Date() }, status: { not: "DONE" } },
            take: 5,
            orderBy: { dueDate: "asc" },
            select: { id: true, title: true, dueDate: true, priority: true },
          }),
        ]);
        return { total: todo + inProgress + inReview + done, byStatus: { TODO: todo, INPROGRESS: inProgress, INREVIEW: inReview, DONE: done }, upcomingDeadlines: upcoming };
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

    case "member_assign": {
      try {
        const permErr = await canModify(args.taskId as string);
        if (permErr) return { error: permErr };
        let resolvedUserId = args.memberId as string;
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
        };
        if (args.description) data.description = args.description;
        if (args.organizationId || organizationId)
          data.organizationId = (args.organizationId as string) || organizationId;

        const project = await prisma.project.create({ data });
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

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
          return { error: `Tarea ${taskId} no encontrada` };
        }

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

    // ---- CRM Tool Execution ----
    case "contact_create": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          id: cuid(),
          name: args.name as string,
          organizationId,
        };
        if (args.email) data.email = args.email as string;
        if (args.phone) data.phone = args.phone as string;
        if (args.company) data.company = args.company as string;
        if (args.notes) data.notes = args.notes as string;
        if (args.tags) data.tags = args.tags as string[];
        if (args.status) data.status = args.status as string;

        const contact = await prisma.contact.create({ data });
        return {
          success: true,
          contact: { id: contact.id, name: contact.name, email: contact.email, status: contact.status },
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al crear contacto: ${msg}` };
      }
    }

    case "contact_list": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { organizationId };
        if (args.status) where.status = args.status as string;
        if (args.search) {
          where.OR = [
            { name: { contains: args.search as string, mode: "insensitive" } },
            { email: { contains: args.search as string, mode: "insensitive" } },
            { company: { contains: args.search as string, mode: "insensitive" } },
          ];
        }
        const limit = (args.limit as number) || 20;
        const contacts = await prisma.contact.findMany({
          where,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true, phone: true, company: true, status: true, tags: true },
        });
        return { contacts, count: contacts.length };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al listar contactos: ${msg}` };
      }
    }

    case "pipeline_list": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        const pipelines = await prisma.pipeline.findMany({
          where: { organizationId },
          select: {
            id: true,
            name: true,
            stages: {
              orderBy: { position: "asc" },
              select: { id: true, name: true, position: true, color: true },
            },
          },
        });
        return { pipelines };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al listar pipelines: ${msg}` };
      }
    }

    case "deal_create": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
          id: cuid(),
          title: args.title as string,
          contactId: args.contactId as string,
          stageId: args.stageId as string,
          pipelineId: (args.pipelineId as string) || "",
          organizationId,
        };
        if (args.value !== undefined) data.value = args.value as number;
        if (args.probability !== undefined) data.probability = args.probability as number;
        if (args.expectedClose) data.expectedClose = new Date(args.expectedClose as string);
        if (args.notes) data.notes = args.notes as string;

        const stage = await prisma.pipelineStage.findUnique({
          where: { id: args.stageId as string },
          select: { pipelineId: true },
        });
        if (stage) data.pipelineId = stage.pipelineId;

        const deal = await prisma.deal.create({ data });
        return { success: true, deal: { id: deal.id, title: deal.title, value: deal.value } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al crear deal: ${msg}` };
      }
    }

    case "deal_list": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { organizationId };
        if (args.stageId) where.stageId = args.stageId as string;
        const limit = (args.limit as number) || 20;
        const deals = await prisma.deal.findMany({
          where,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            value: true,
            probability: true,
            stage: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true } },
          },
        });
        return { deals, count: deals.length };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al listar deals: ${msg}` };
      }
    }

    case "deal_move": {
      const orgErr = requireOrg();
      if (orgErr) return { error: orgErr };
      try {
        const deal = await prisma.deal.update({
          where: { id: args.dealId as string },
          data: { stageId: args.stageId as string },
          select: { id: true, title: true, stage: { select: { name: true } } },
        });
        return { success: true, deal: { id: deal.id, title: deal.title, stage: deal.stage.name } };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `Error al mover deal: ${msg}` };
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
  knowledgeBase?: string,
  clientContext?: string
): Promise<string> {
  const currentDate = new Date().toISOString().split("T")[0];
  return `Eres el Asistente IA de taskProject. Eres un gestor profesional de proyectos de marketing digital. Ayudas a gestionar clientes, campañas, tareas y equipos de forma directa y eficiente.
## Identidad
- Nombre: Asistente taskProject
- Hablas en el idioma del usuario (detecta y adapta)
- Personalidad: directo, eficiente, sin relleno. Piensas como un director de proyectos de marketing.
- Si puedes hacer algo, lo haces. Si necesitas info, preguntas lo mínimo.
- Entiendes marketing digital: SEO, SEM, social media, campañas publicitarias, análisis de métricas, etc.

## Contexto actual
- Cliente activo: ${projectName || "Ninguno"} (ID: ${projectId || "N/A"})
- Agencia: ${orgName || "Ninguno"} (ID: ${orgId || "N/A"})
- Usuario: ${userName} (ID: ${userId})
- Fecha actual: ${currentDate}

## Aislamiento de proyectos — REGLAS CRÍTICAS
- SOLO puedes trabajar con datos del cliente activo y su contexto asociado.
- JAMÁS menciones, reveles o proceses información de otros clientes o agencias.
- Si el usuario pregunta sobre un proyecto, solo puedes usar los datos del cliente activo.
- Si no hay contexto del cliente cargado en el proyecto activo, avisa al usuario y no inventes información.
- El contexto del cliente (clientContext) es información confidencial del cliente activo: úsala solo para responder sobre ese contexto específico.
## Reglas
- Ante un mensaje ambiguo, interpreta la intención más probable y actúa.
- Para crear tareas: si no se especifica prioridad, usa NONE. Si no se especifica estado, usa TODO.
- Para listar tareas: muestra máximo 10 y ofrece ver más.
- Nunca inventes IDs. Usa los datos del contexto.
- Si el usuario pide algo fuera de tu alcance, dile qué puede hacer y sugiere acción manual.
- Respuestas concisas. Máximo 3-4 líneas salvo que se pida detalle.
- Para acciones destructivas (eliminar), confirma brevemente antes.
- MUY IMPORTANTE: Para actualizar/mover/eliminar tareas, usa SIEMPRE el ID exacto del listado de tareas actual. NUNCA inventes IDs.
- ADJUNTOS AUTOMÁTICOS: Cuando generes contenido extenso (más de 200 caracteres) como reportes, documentos, análisis, resúmenes detallados, posts, emails, copys o cualquier contenido textual largo, DEBES: (1) Crear el contenido como archivo adjunto usando la tool task_attachment, (2) Responder al usuario con un resumen breve de 2-3 líneas indicando que has creado un archivo adjunto con el contenido completo.
- ANTES DE CREAR CONTENIDO para un cliente, usa la tool client_context para obtener información del contexto. Siempre adapta el contenido a la estrategia del cliente.
- Si el usuario menciona un cliente por nombre y no coincide con el cliente activo, avísale.
- Cuando el usuario proporcione información sobre el cliente (estilo, referencias, estrategia, etc.), usa client_context_update para guardarla.
## CRM — Gestión de contactos y oportunidades
- Puedes crear contactos, deals/oportunidades y gestionar el pipeline del CRM.
- Para crear un deal, primero necesitas un contacto y una etapa del pipeline. Usa contact_list y pipeline_list para obtener los IDs necesarios.
- Cuando el usuario diga algo como "añade una oportunidad", "crea un lead", "nuevo cliente potencial", usa las tools de CRM.
- Si el usuario menciona una empresa o persona que no está en el CRM, sugiere crearla como contacto.

## Tareas del cliente actual
${taskList || "Sin cliente activo."}

## Miembros del proyecto
${memberList || "Sin cliente activo."}

${knowledgeBase ? `## Base de conocimiento de la organización
${knowledgeBase}` : ""}
${clientContext ? `## Contexto del cliente (${projectName})
${clientContext}` : ""}`;
}

// ---- Streaming LLM helper ----
async function streamCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
): Promise<{
  content: string;
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const result = {
    content: "",
    toolCalls: [] as Array<{ id: string; function: { name: string; arguments: string } }>,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };

  if (!body.stream) {
    const data = await response.json();
    result.content = data.choices?.[0]?.message?.content || "";
    result.usage = data.usage || result.usage;
    if (data.choices?.[0]?.message?.tool_calls) {
      result.toolCalls = data.choices[0].message.tool_calls;
    }
    return result;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) {
          result.content += delta.content;
          onToken(delta.content);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!result.toolCalls[idx]) {
              result.toolCalls[idx] = {
                id: tc.id || "",
                function: { name: "", arguments: "" },
              };
            }
            if (tc.id) result.toolCalls[idx].id = tc.id;
            if (tc.function?.name) result.toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) result.toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }

        if (parsed.usage) {
          result.usage = parsed.usage;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return result;
}

// ---- GET: chat history ----
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const agentId = searchParams.get("agentId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: authResult.userId };
    if (projectId) where.projectId = projectId;
    if (agentId) where.agentId = agentId;
    if (!projectId && !agentId) {
      where.agentId = null;
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true, projectId: true, agentId: true },
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar historial" }, { status: 500 });
  }
}

// ---- POST: main handler (streaming) ----
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rateCheck = await aiRateLimit(authResult.userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Has alcanzado el límite de mensajes. Espera un momento.", remaining: rateCheck.remaining },
      { status: 429 }
    );
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

  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: { name: true, email: true },
  });

  let taskList = "Sin proyecto activo.";
  let memberList = "Sin proyecto activo.";

  if (projectId) {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        taskAssignees: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    taskList = tasks.map((t) => {
      const assignees = [
        t.assignee ? `${t.assignee.name || t.assignee.email} (ID: ${t.assignee.id})` : null,
        ...t.taskAssignees.map(ta => `${ta.user.name || ta.user.email} (ID: ${ta.user.id})`)
      ].filter(Boolean);
      const assigneeText = assignees.length > 0 ? `Asignado a: ${assignees.join(", ")}` : "Sin asignar";
      const dueStr = t.dueDate ? t.dueDate.toISOString().split("T")[0] : "sin fecha";
      return `- [${t.id}] "${t.title}" | Estado: ${t.status} | Prioridad: ${t.priority} | ${assigneeText} | Vence: ${dueStr}`;
    }).join("\n") || "No hay tareas.";

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    });
    memberList = members.map((m: { userId: string; role: string; user: { name: string | null; email: string | null } | null }) => `- [${m.userId}] ${m.user?.name || m.user?.email} (${m.role})`).join("\n") || "No hay miembros.";
  }

  let knowledgeBase: string | undefined;
  if (organizationId) {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { organizationId },
    });
    if (kb?.content) {
      knowledgeBase = kb.content;
    }
  }

  let clientContext: string | undefined;
  if (projectId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, clientContext: true },
    });
    if (proj?.clientContext) {
      clientContext = proj.clientContext;
    }
  }

  let systemPrompt = await buildSystemPrompt(
    user ? `${user.name || "Usuario"} (${user.email})` : "Usuario",
    authResult.userId,
    projectName,
    projectId,
    orgName,
    organizationId,
    taskList,
    memberList,
    knowledgeBase,
    clientContext
  );

  systemPrompt = enforceTokenBudget(systemPrompt);

  const messages: Array<{ role: string; content: string | null; tool_calls?: unknown }> = [
    { role: "system", content: systemPrompt },
  ];

  if (history && Array.isArray(history)) {
    const recentHistory = history.slice(-20);
    messages.push(...recentHistory.map((m) => ({ role: m.role, content: m.content })));
  }

  messages.push({ role: "user", content: message });

  await prisma.chatMessage.create({
    data: {
      userId: authResult.userId,
      projectId: projectId || null,
      role: "user",
      content: message,
      organizationId: organizationId || null,
    },
  });

  const apiKey = process.env.GLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key no configurada (GLM_API_KEY o OPENAI_API_KEY)" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.GLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.CHAT_MODEL || "glm-4.5-air";

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const firstResult = await streamCompletion(
          `${baseUrl}/chat/completions`,
          apiKey,
          { model, messages, tools: TOOLS, tool_choice: "auto", max_tokens: 2000, temperature: 0.7, stream: true },
          (token) => send({ type: "token", content: token })
        );

        if (firstResult.toolCalls.length === 0) {
          const reply = firstResult.content || "";
          await prisma.chatMessage.create({
            data: {
              userId: authResult.userId,
              projectId: projectId || null,
              role: "assistant",
              content: reply,
              organizationId: organizationId || null,
            },
          });
          const duration = Date.now() - startTime;
          await prisma.taskyUsage.create({
            data: {
              userId: authResult.userId,
              organizationId: organizationId || null,
              projectId: projectId || null,
              prompt: message,
              toolsUsed: [],
              responseTokens: firstResult.usage.completion_tokens || null,
              duration,
            },
          }).catch(() => {});
          send({ type: "done", actions: [] });
          controller.close();
          return;
        }

        const actions: Array<{ tool: string; result: unknown }> = [];
        const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

        for (const toolCall of firstResult.toolCalls) {
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
          send({ type: "action", tool: toolName, result });
        }

        const assistantMsg = {
          role: "assistant" as const,
          content: firstResult.content || null,
          tool_calls: firstResult.toolCalls,
        };

        const secondMessages = [
          ...messages,
          assistantMsg,
          ...toolResults,
        ];

        const secondResult = await streamCompletion(
          `${baseUrl}/chat/completions`,
          apiKey,
          { model, messages: secondMessages, max_tokens: 2000, temperature: 0.7, stream: true },
          (token) => send({ type: "token", content: token })
        );

        const finalReply = secondResult.content || "Acción completada.";
        await prisma.chatMessage.create({
          data: {
            userId: authResult.userId,
            projectId: projectId || null,
            role: "assistant",
            content: finalReply,
            organizationId: organizationId || null,
          },
        });

        const duration = Date.now() - startTime;
        const toolsUsed = actions.map((a) => a.tool);
        await prisma.taskyUsage.create({
          data: {
            userId: authResult.userId,
            organizationId: organizationId || null,
            projectId: projectId || null,
            prompt: message,
            toolsUsed,
            responseTokens: (firstResult.usage.completion_tokens || 0) + (secondResult.usage.completion_tokens || 0),
            duration,
          },
        }).catch(() => {});

        send({ type: "done", actions });
        controller.close();
      } catch (error) {
        console.error("Chat streaming error:", error);
        send({ type: "error", error: `Error interno: ${error instanceof Error ? error.message : String(error)}` });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
