'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { noteCreateSchema, noteUpdateSchema } from '@/lib/validations'
import type { ActionResult, NoteWithTags } from '@/types'

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

// Helper to generate excerpt from HTML content
function generateExcerpt(content: string, maxLength = 200): string {
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, '')
  // Decode HTML entities
  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  // Truncate
  return decoded.length > maxLength ? decoded.slice(0, maxLength) + '...' : decoded
}

// Create a new note
export async function createNote(data: {
  title: string
  content?: string
  folderId?: string | null
  tags?: string[]
}): Promise<ActionResult<NoteWithTags>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = noteCreateSchema.parse(data)
    const excerpt = validated.content ? generateExcerpt(validated.content) : null

    // Create note with tags
    const note = await prisma.note.create({
      data: {
        title: validated.title,
        content: validated.content || '',
        excerpt,
        userId,
        folderId: validated.folderId || null,
        tags: {
          create: (validated.tags || []).map(tagId => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/notes')
    return { success: true, data: note as NoteWithTags }
  } catch (error) {
    console.error('Error creating note:', error)
    return { success: false, error: 'Error al crear la nota' }
  }
}

// Update an existing note
export async function updateNote(
  noteId: string,
  data: {
    title?: string
    content?: string
    isFavorite?: boolean
    isArchived?: boolean
    folderId?: string | null
    tags?: string[]
  }
): Promise<ActionResult<NoteWithTags>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = noteUpdateSchema.parse(data)

    // Verify ownership
    const existingNote = await prisma.note.findFirst({
      where: { id: noteId, userId },
    })
    if (!existingNote) {
      return { success: false, error: 'Nota no encontrada' }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.content !== undefined) {
      updateData.content = validated.content
      updateData.excerpt = generateExcerpt(validated.content)
    }
    if (validated.isFavorite !== undefined) updateData.isFavorite = validated.isFavorite
    if (validated.isArchived !== undefined) updateData.isArchived = validated.isArchived
    if (validated.folderId !== undefined) updateData.folderId = validated.folderId

    // Update note
    const note = await prisma.note.update({
      where: { id: noteId },
      data: updateData,
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    })

    // Update tags if provided
    if (validated.tags !== undefined) {
      // Delete existing tag relations
      await prisma.noteTag.deleteMany({
        where: { noteId },
      })
      // Create new tag relations
      if (validated.tags.length > 0) {
        await prisma.noteTag.createMany({
          data: validated.tags.map(tagId => ({ noteId, tagId })),
        })
      }
      // Refetch with new tags
      const updatedNote = await prisma.note.findUnique({
        where: { id: noteId },
        include: {
          tags: { include: { tag: true } },
          folder: true,
        },
      })
      revalidatePath('/dashboard')
      revalidatePath('/notes')
      revalidatePath(`/notes/${noteId}`)
      return { success: true, data: updatedNote as NoteWithTags }
    }

    revalidatePath('/dashboard')
    revalidatePath('/notes')
    revalidatePath(`/notes/${noteId}`)
    return { success: true, data: note as NoteWithTags }
  } catch (error) {
    console.error('Error updating note:', error)
    return { success: false, error: 'Error al actualizar la nota' }
  }
}

// Soft delete a note (move to trash)
export async function deleteNote(noteId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
    })
    if (!note) {
      return { success: false, error: 'Nota no encontrada' }
    }

    await prisma.note.update({
      where: { id: noteId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/notes')
    revalidatePath('/trash')
    return { success: true }
  } catch (error) {
    console.error('Error deleting note:', error)
    return { success: false, error: 'Error al eliminar la nota' }
  }
}

// Restore a deleted note
export async function restoreNote(noteId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const note = await prisma.note.findFirst({
      where: { id: noteId, userId, isDeleted: true },
    })
    if (!note) {
      return { success: false, error: 'Nota no encontrada' }
    }

    await prisma.note.update({
      where: { id: noteId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/notes')
    revalidatePath('/trash')
    return { success: true }
  } catch (error) {
    console.error('Error restoring note:', error)
    return { success: false, error: 'Error al restaurar la nota' }
  }
}

// Permanently delete a note
export async function permanentDeleteNote(noteId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const note = await prisma.note.findFirst({
      where: { id: noteId, userId, isDeleted: true },
    })
    if (!note) {
      return { success: false, error: 'Nota no encontrada' }
    }

    await prisma.note.delete({
      where: { id: noteId },
    })

    revalidatePath('/trash')
    return { success: true }
  } catch (error) {
    console.error('Error permanently deleting note:', error)
    return { success: false, error: 'Error al eliminar permanentemente la nota' }
  }
}

// Get a single note by ID
export async function getNote(noteId: string): Promise<ActionResult<NoteWithTags>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    })

    if (!note) {
      return { success: false, error: 'Nota no encontrada' }
    }

    return { success: true, data: note as NoteWithTags }
  } catch (error) {
    console.error('Error fetching note:', error)
    return { success: false, error: 'Error al obtener la nota' }
  }
}

// Get all notes for the current user
export async function getNotes(options?: {
  includeDeleted?: boolean
  folderId?: string
  favoritesOnly?: boolean
  archivedOnly?: boolean
}): Promise<ActionResult<NoteWithTags[]>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const where: Record<string, unknown> = { userId }

    if (!options?.includeDeleted) {
      where.isDeleted = false
    }

    if (options?.folderId) {
      where.folderId = options.folderId
    }

    if (options?.favoritesOnly) {
      where.isFavorite = true
    }

    if (options?.archivedOnly) {
      where.isArchived = true
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return { success: true, data: notes as NoteWithTags[] }
  } catch (error) {
    console.error('Error fetching notes:', error)
    return { success: false, error: 'Error al obtener las notas' }
  }
}

// Get dashboard stats
export async function getNoteStats(): Promise<
  ActionResult<{
    totalNotes: number
    favoriteNotes: number
    archivedNotes: number
    deletedNotes: number
  }>
> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const [totalNotes, favoriteNotes, archivedNotes, deletedNotes] = await Promise.all([
      prisma.note.count({ where: { userId, isDeleted: false } }),
      prisma.note.count({ where: { userId, isFavorite: true, isDeleted: false } }),
      prisma.note.count({ where: { userId, isArchived: true, isDeleted: false } }),
      prisma.note.count({ where: { userId, isDeleted: true } }),
    ])

    return {
      success: true,
      data: { totalNotes, favoriteNotes, archivedNotes, deletedNotes },
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    return { success: false, error: 'Error al obtener estadísticas' }
  }
}

// Search notes
export async function searchNotes(query: string): Promise<ActionResult<NoteWithTags[]>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const notes = await prisma.note.findMany({
      where: {
        userId,
        isDeleted: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    return { success: true, data: notes as NoteWithTags[] }
  } catch (error) {
    console.error('Error searching notes:', error)
    return { success: false, error: 'Error al buscar notas' }
  }
}