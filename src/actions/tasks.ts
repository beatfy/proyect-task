'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { TaskFilters, CreateTaskInput, UpdateTaskInput, CreateProjectInput, UpdateProjectInput } from '@/types/tasks'
import type { ActionResult } from '@/types'

// ============================================================================
// PROJECT ACTIONS
// ============================================================================

export async function getProjects(): Promise<ActionResult<{ active: any[]; archived: any[] }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: { tasks: { where: { isArchived: false } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const active = projects.filter(p => !p.isArchived)
    const archived = projects.filter(p => p.isArchived)

    return { success: true, data: { active, archived } }
  } catch (error) {
    console.error('Error fetching projects:', error)
    return { success: false, error: 'Error al obtener proyectos' }
  }
}

export async function getProject(id: string): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        tasks: {
          where: { parentId: null, isArchived: false },
          include: {
            subtasks: true
          },
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' }
          ]
        },
        _count: {
          select: { tasks: { where: { isArchived: false } } }
        }
      }
    })

    if (!project) {
      return { success: false, error: 'Proyecto no encontrado' }
    }

    return { success: true, data: project }
  } catch (error) {
    console.error('Error fetching project:', error)
    return { success: false, error: 'Error al obtener proyecto' }
  }
}

export async function createProject(data: CreateProjectInput): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#3b82f6',
        icon: data.icon,
        userId
      }
    })

    revalidatePath('/projects')
    return { success: true, data: project }
  } catch (error) {
    console.error('Error creating project:', error)
    return { success: false, error: 'Error al crear proyecto' }
  }
}

export async function updateProject(id: string, data: UpdateProjectInput): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const project = await prisma.project.update({
      where: { id, userId },
      data
    })

    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    return { success: true, data: project }
  } catch (error) {
    console.error('Error updating project:', error)
    return { success: false, error: 'Error al actualizar proyecto' }
  }
}

export async function archiveProject(id: string): Promise<ActionResult> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    await prisma.project.update({
      where: { id, userId },
      data: { isArchived: true }
    })

    revalidatePath('/projects')
    return { success: true }
  } catch (error) {
    console.error('Error archiving project:', error)
    return { success: false, error: 'Error al archivar proyecto' }
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    await prisma.project.delete({
      where: { id, userId }
    })

    revalidatePath('/projects')
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { success: false, error: 'Error al eliminar proyecto' }
  }
}

// ============================================================================
// TASK ACTIONS
// ============================================================================

export async function getTasks(filters?: TaskFilters): Promise<ActionResult<any[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const where: any = { userId, parentId: null }

    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.priority) {
      where.priority = filters.priority
    }
    if (filters?.projectId) {
      where.projectId = filters.projectId
    }
    if (filters?.dueDateFrom || filters?.dueDateTo) {
      where.dueDate = {}
      if (filters.dueDateFrom) where.dueDate.gte = filters.dueDateFrom
      if (filters.dueDateTo) where.dueDate.lte = filters.dueDateTo
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        subtasks: true,
        project: true
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return { success: true, data: tasks }
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return { success: false, error: 'Error al obtener tareas' }
  }
}

export async function getTask(id: string): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: {
        subtasks: {
          orderBy: { createdAt: 'asc' }
        },
        project: true
      }
    })

    if (!task) {
      return { success: false, error: 'Tarea no encontrada' }
    }

    return { success: true, data: task }
  } catch (error) {
    console.error('Error fetching task:', error)
    return { success: false, error: 'Error al obtener tarea' }
  }
}

export async function createTask(data: CreateTaskInput): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority || 'NONE',
        dueDate: data.dueDate,
        projectId: data.projectId,
        parentId: data.parentId,
        userId
      },
      include: {
        project: true
      }
    })

    revalidatePath('/tasks')
    if (data.projectId) {
      revalidatePath(`/projects/${data.projectId}`)
    }
    return { success: true, data: task }
  } catch (error) {
    console.error('Error creating task:', error)
    return { success: false, error: 'Error al crear tarea' }
  }
}

export async function updateTask(id: string, data: UpdateTaskInput): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const updateData: any = { ...data }
    
    // If status is set to DONE, set completedAt
    if (data.status === 'DONE') {
      updateData.completedAt = new Date()
    } else if (data.status && data.status !== 'DONE') {
      updateData.completedAt = null
    }

    const task = await prisma.task.update({
      where: { id, userId },
      data: updateData,
      include: {
        subtasks: true,
        project: true
      }
    })

    revalidatePath('/tasks')
    if (task.projectId) {
      revalidatePath(`/projects/${task.projectId}`)
    }
    return { success: true, data: task }
  } catch (error) {
    console.error('Error updating task:', error)
    return { success: false, error: 'Error al actualizar tarea' }
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const task = await prisma.task.findFirst({
      where: { id, userId }
    })

    await prisma.task.delete({
      where: { id, userId }
    })

    revalidatePath('/tasks')
    if (task?.projectId) {
      revalidatePath(`/projects/${task.projectId}`)
    }
    return { success: true }
  } catch (error) {
    console.error('Error deleting task:', error)
    return { success: false, error: 'Error al eliminar tarea' }
  }
}

export async function getTaskStats(): Promise<ActionResult<any>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'No autenticado' }
    }

    const [totalProjects, activeProjects, totalTasks, completedTasks, overdueTasks, urgentTasks] = await Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.project.count({ where: { userId, isArchived: false } }),
      prisma.task.count({ where: { userId, isArchived: false } }),
      prisma.task.count({ where: { userId, status: 'DONE' } }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'DONE' },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.task.count({
        where: {
          userId,
          priority: 'URGENT',
          status: { not: 'DONE' }
        }
      })
    ])

    return {
      success: true,
      data: {
        totalProjects,
        activeProjects,
        archivedProjects: totalProjects - activeProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
        urgentTasks
      }
    }
  } catch (error) {
    console.error('Error fetching task stats:', error)
    return { success: false, error: 'Error al obtener estadísticas' }
  }
}