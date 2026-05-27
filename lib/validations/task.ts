import { z } from "zod";

export const taskStatuses = ["TODO", "INPROGRESS", "INREVIEW", "DONE"] as const;
export const taskPriorities = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;

// Accepts both "2026-03-31" (date-only from input) and "2026-03-31T00:00:00Z" (ISO datetime)
const dateField = z.string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Fecha inválida" })
  .optional()
  .nullable();

// Accept null, undefined, empty string (treated as null), or valid email
const emailOrBlank = z.union([
  z.string().email("Email inválido"),
  z.literal(""),
  z.null(),
]).optional().transform(val => val === "" ? null : val);

export const taskCreateSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200, "Máximo 200 caracteres"),
  description: z.string().max(5000, "Máximo 5000 caracteres").optional().nullable(),
  status: z.enum(taskStatuses).default("TODO"),
  priority: z.enum(taskPriorities).default("NONE"),
  dueDate: dateField,
  projectId: z.string().optional().nullable(),
  assignedTo: emailOrBlank,
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().nullable(),
  parentId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
});

export const taskUpdateSchema = z.object({
  id: z.string().min(1, "ID requerido"),
  title: z.string().min(1, "El título es requerido").max(200, "Máximo 200 caracteres").optional(),
  description: z.string().max(5000, "Máximo 5000 caracteres").optional().nullable(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  dueDate: dateField,
  projectId: z.string().optional().nullable(),
  assignedTo: emailOrBlank,
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().nullable(),
  organizationId: z.string().optional().nullable(),
});
