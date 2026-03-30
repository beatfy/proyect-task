import { z } from "zod";

export const commentCreateSchema = z.object({
  taskId: z.string().min(1, "taskId requerido"),
  content: z.string().min(1, "El contenido es requerido").max(2000, "Máximo 2000 caracteres"),
});
