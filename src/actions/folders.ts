'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { folderCreateSchema, folderUpdateSchema } from '@/lib/validations'
import type { ActionResult, FolderWithNotes } from '@/types'

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

// Create a new folder
export async function createFolder(data: {
  name: string
  color?: string | null
  icon?: string | null
}): Promise<ActionResult<FolderWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = folderCreateSchema.parse(data)

    const folder = await prisma.folder.create({
      data: {
        name: validated.name,
        color: validated.color || null,
        icon: validated.icon || null,
        userId,
      },
    })

    revalidatePath('/folders')
    revalidatePath('/dashboard')
    return { success: true, data: { ...folder, _count: { notes: 0 } } }
  } catch (error) {
    console.error('Error creating folder:', error)
    return { success: false, error: 'Error al crear la carpeta' }
  }
}

// Update a folder
export async function updateFolder(
  folderId: string,
  data: {
    name?: string
    color?: string | null
    icon?: string | null
  }
): Promise<ActionResult<FolderWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const validated = folderUpdateSchema.parse(data)

    // Verify ownership
    const existingFolder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    })
    if (!existingFolder) {
      return { success: false, error: 'Carpeta no encontrada' }
    }

    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.color !== undefined && { color: validated.color }),
        ...(validated.icon !== undefined && { icon: validated.icon }),
      },
      include: {
        _count: { select: { notes: true } },
      },
    })

    revalidatePath('/folders')
    revalidatePath('/dashboard')
    return { success: true, data: folder as FolderWithNotes }
  } catch (error) {
    console.error('Error updating folder:', error)
    return { success: false, error: 'Error al actualizar la carpeta' }
  }
}

// Delete a folder
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    })
    if (!folder) {
      return { success: false, error: 'Carpeta no encontrada' }
    }

    // Notes in this folder will have folderId set to null due to onDelete: SetNull
    await prisma.folder.delete({
      where: { id: folderId },
    })

    revalidatePath('/folders')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error deleting folder:', error)
    return { success: false, error: 'Error al eliminar la carpeta' }
  }
}

// Get all folders for the current user
export async function getFolders(): Promise<ActionResult<FolderWithNotes[]>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: { where: { isDeleted: false } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: folders as FolderWithNotes[] }
  } catch (error) {
    console.error('Error fetching folders:', error)
    return { success: false, error: 'Error al obtener las carpetas' }
  }
}

// Get a single folder by ID
export async function getFolder(folderId: string): Promise<ActionResult<FolderWithNotes>> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: 'No autorizado' }
    }

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      include: {
        _count: {
          select: { notes: { where: { isDeleted: false } } },
        },
      },
    })

    if (!folder) {
      return { success: false, error: 'Carpeta no encontrada' }
    }

    return { success: true, data: folder as FolderWithNotes }
  } catch (error) {
    console.error('Error fetching folder:', error)
    return { success: false, error: 'Error al obtener la carpeta' }
  }
}