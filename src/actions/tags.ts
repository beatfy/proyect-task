'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { tagCreateSchema, tagUpdateSchema } from '@/lib/validations'
import type { ActionResult, TagWithNotes } from '@/types'

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

// Create a new tag
export async function createTag(data: {
  name: string
  color?: string | null
}): Promise<ActionResult<TagWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = tagCreateSchema.parse(data)

    // Check if tag with same name already exists for this user
    const existingTag = await prisma.tag.findFirst({
      where: { userId, name: validated.name },
    })
    if (existingTag) {
      return { success: false, error: 'Ya existe una etiqueta con ese nombre' }
    }

    const tag = await prisma.tag.create({
      data: {
        name: validated.name,
        color: validated.color || null,
        userId,
      },
    })

    revalidatePath('/notes')
    revalidatePath('/dashboard')
    return { success: true, data: { ...tag, _count: { notes: 0 } } }
  } catch (error) {
    console.error('Error creating tag:', error)
    return { success: false, error: 'Error al crear la etiqueta' }
  }
}

// Update a tag
export async function updateTag(
  tagId: string,
  data: {
    name?: string
    color?: string | null
  }
): Promise<ActionResult<TagWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = tagUpdateSchema.parse(data)

    // Verify ownership
    const existingTag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    })
    if (!existingTag) {
      return { success: false, error: 'Etiqueta no encontrada' }
    }

    // Check if new name conflicts with existing tag
    if (validated.name && validated.name !== existingTag.name) {
      const nameConflict = await prisma.tag.findFirst({
        where: { userId, name: validated.name, NOT: { id: tagId } },
      })
      if (nameConflict) {
        return { success: false, error: 'Ya existe una etiqueta con ese nombre' }
      }
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.color !== undefined && { color: validated.color }),
      },
      include: {
        _count: { select: { notes: true } },
      },
    })

    revalidatePath('/notes')
    revalidatePath('/dashboard')
    return { success: true, data: tag as TagWithNotes }
  } catch (error) {
    console.error('Error updating tag:', error)
    return { success: false, error: 'Error al actualizar la etiqueta' }
  }
}

// Delete a tag
export async function deleteTag(tagId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    })
    if (!tag) {
      return { success: false, error: 'Etiqueta no encontrada' }
    }

    // NoteTag relations will be deleted automatically due to onDelete: Cascade
    await prisma.tag.delete({
      where: { id: tagId },
    })

    revalidatePath('/notes')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error deleting tag:', error)
    return { success: false, error: 'Error al eliminar la etiqueta' }
  }
}

// Get all tags for the current user
export async function getTags(): Promise<ActionResult<TagWithNotes[]>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: { where: { note: { isDeleted: false } } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: tags as TagWithNotes[] }
  } catch (error) {
    console.error('Error fetching tags:', error)
    return { success: false, error: 'Error al obtener las etiquetas' }
  }
}

// Get a single tag by ID
export async function getTag(tagId: string): Promise<ActionResult<TagWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    })

    if (!tag) {
      return { success: false, error: 'Etiqueta no encontrada' }
    }

    return { success: true, data: tag as TagWithNotes }
  } catch (error) {
    console.error('Error fetching tag:', error)
    return { success: false, error: 'Error al obtener la etiqueta' }
  }
}