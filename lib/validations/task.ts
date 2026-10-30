import { z } from "zod";

export const taskStatuses = ["TODO", "INPROGRESS", "INREVIEW", "DONE", "ARCHIVED"] as const;
export const taskPriorities = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

// Robust priority parser: accepts numbers (0..5), string digits ("1".."5"),
// and string literals ("LOW", "low", "HIGH", etc.)
export const prioritySchema = z.preprocess((val) => {
  if (val === null || val === undefined) return "NONE";
  if (typeof val === "number") {
    switch (val) {
      case 0: return "NONE";
      case 1: return "LOW";
      case 2: return "MEDIUM";
      case 3: return "HIGH";
      case 4:
      case 5: return "URGENT";
      default: return val > 5 ? "URGENT" : "NONE";
    }
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[0-9]+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      switch (num) {
        case 0: return "NONE";
        case 1: return "LOW";
        case 2: return "MEDIUM";
        case 3: return "HIGH";
        default: return num >= 4 ? "URGENT" : "NONE";
      }
    }
    const upper = trimmed.toUpperCase();
    if (taskPriorities.includes(upper as any)) return upper;
  }
  return val;
}, z.enum(taskPriorities));

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
  status: z.string().default("TODO"),
  priority: prioritySchema.default("NONE"),
  dueDate: dateField,
  projectId: z.string().optional().nullable(),
  assignedTo: emailOrBlank,
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().nullable(),
  parentId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  pipelineId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  tdahMetrics: z.any().optional().nullable(),
  subtasks: z.array(z.union([
    z.string(),
    z.object({ title: z.string() })
  ])).optional().nullable(),
});

export const taskUpdateSchema = z.object({
  id: z.string().min(1, "ID requerido").optional(),
  title: z.string().min(1, "El título es requerido").max(200, "Máximo 200 caracteres").optional(),
  description: z.string().max(5000, "Máximo 5000 caracteres").optional().nullable(),
  status: z.string().optional(),
  priority: prioritySchema.optional(),
  dueDate: dateField,
  projectId: z.string().optional().nullable(),
  assignedTo: emailOrBlank,
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().nullable(),
  organizationId: z.string().optional().nullable(),
  pipelineId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  tdahMetrics: z.any().optional().nullable(),
  subtasks: z.array(z.union([
    z.string(),
    z.object({ title: z.string() })
  ])).optional().nullable(),
});
