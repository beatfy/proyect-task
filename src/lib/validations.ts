import { z } from 'zod'

// Note validation schemas
export const noteCreateSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título no puede exceder 200 caracteres'),
  content: z.string().optional().default(''),
  excerpt: z.string().max(300, 'El extracto no puede exceder 300 caracteres').optional(),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
})

export const noteUpdateSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'El título no puede exceder 200 caracteres').optional(),
  content: z.string().optional(),
  excerpt: z.string().max(300, 'El extracto no puede exceder 300 caracteres').optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

// Folder validation schemas
export const folderCreateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional().nullable(),
  icon: z.string().max(10, 'El icono no puede exceder 10 caracteres').optional().nullable(),
})

export const folderUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional().nullable(),
  icon: z.string().max(10, 'El icono no puede exceder 10 caracteres').optional().nullable(),
})

// Tag validation schemas
export const tagCreateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(50, 'El nombre no puede exceder 50 caracteres'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional().nullable(),
})

export const tagUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(50, 'El nombre no puede exceder 50 caracteres').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional().nullable(),
})

// Search validation
export const searchSchema = z.object({
  query: z.string().min(1, 'La búsqueda no puede estar vacía').max(200, 'La búsqueda no puede exceder 200 caracteres'),
})

// Type exports
export type NoteCreateInput = z.infer<typeof noteCreateSchema>
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>
export type FolderCreateInput = z.infer<typeof folderCreateSchema>
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>
export type TagCreateInput = z.infer<typeof tagCreateSchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>
export type SearchInput = z.infer<typeof searchSchema>