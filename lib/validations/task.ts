import { z } from "zod";

export const taskStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const;
export const taskPriorities = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const taskCreateSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200, "Máximo 200 caracteres"),
  description: z.string().max(5000, "Máximo 5000 caracteres").optional().nullable(),
  status: z.enum(taskStatuses).default("TODO"),
  priority: z.enum(taskPriorities).default("NONE"),
  dueDate: z.string().datetime({ message: "Fecha inválida" }).optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedTo: z.string().email("Email inválido").optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export const taskUpdateSchema = z.object({
  id: z.string().min(1, "ID requerido"),
  title: z.string().min(1, "El título es requerido").max(200, "Máximo 200 caracteres").optional(),
  description: z.string().max(5000, "Máximo 5000 caracteres").optional().nullable(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  dueDate: z.string().datetime({ message: "Fecha inválida" }).optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedTo: z.string().email("Email inválido").optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});
