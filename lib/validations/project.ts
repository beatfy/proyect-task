import { z } from "zod";

export const projectCreateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres").optional(),
  description: z.string().max(1000, "Máximo 1000 caracteres").optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});
