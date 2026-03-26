import type { Task, Project } from '@prisma/client'

// Task with relations
export interface TaskWithSubtasks {
  id: string
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: Date | null
  completedAt: Date | null
  isArchived: boolean
  userId: string
  projectId: string | null
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  subtasks: TaskWithSubtasks[]
  project: Project | null
}

// Project with tasks
export interface ProjectWithTasks {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  isArchived: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
  tasks: TaskWithSubtasks[]
  _count?: {
    tasks: number
  }
}

// Project stats
export interface ProjectStats {
  totalProjects: number
  activeProjects: number
  archivedProjects: number
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  urgentTasks: number
}

// Task filters
export interface TaskFilters {
  status?: string
  priority?: string
  projectId?: string
  dueDateFrom?: Date
  dueDateTo?: Date
  search?: string
}

// Create task input
export interface CreateTaskInput {
  title: string
  description?: string
  priority?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: Date
  projectId?: string
  parentId?: string
}

// Update task input
export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
  priority?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: Date
  projectId?: string
}

// Create project input
export interface CreateProjectInput {
  name: string
  description?: string
  color?: string
  icon?: string
}

// Update project input
export interface UpdateProjectInput {
  name?: string
  description?: string
  color?: string
  icon?: string
}