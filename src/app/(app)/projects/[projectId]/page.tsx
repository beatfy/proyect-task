'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, CheckCircle, Circle, Clock, AlertCircle, MoreVertical, Trash2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getProject, createTask, updateTask, deleteTask } from '@/actions/tasks'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { toast } from 'sonner'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  completedAt: Date | null
  subtasks: Task[]
}

interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  tasks: Task[]
  _count?: { tasks: number }
}

const priorityColors: Record<string, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  LOW: 'bg-blue-100 text-blue-600',
  MEDIUM: 'bg-yellow-100 text-yellow-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
}

const priorityLabels: Record<string, string> = {
  NONE: 'Sin prioridad',
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const statusLabels: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  DONE: 'Completado',
  CANCELLED: 'Cancelado',
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProject()
  }, [projectId])

  async function loadProject() {
    setLoading(true)
    const result = await getProject(projectId)
    if (result.success) {
      setProject(result.data!)
    } else {
      toast.error(result.error)
      router.push('/projects')
    }
    setLoading(false)
  }

  async function handleCreateTask(data: { title: string; description?: string; priority?: string; dueDate?: Date }) {
    const result = await createTask({
      ...data,
      projectId
    })
    if (result.success) {
      toast.success('Tarea creada')
      setDialogOpen(false)
      loadProject()
    } else {
      toast.error(result.error)
    }
  }

  async function handleCreateSubtask(parentId: string, data: { title: string }) {
    const result = await createTask({
      title: data.title,
      projectId,
      parentId
    })
    if (result.success) {
      toast.success('Subtarea creada')
      setSubtaskDialogOpen(null)
      loadProject()
    } else {
      toast.error(result.error)
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE'
    const result = await updateTask(taskId, { status: newStatus })
    if (result.success) {
      loadProject()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDeleteTask(taskId: string) {
    const result = await deleteTask(taskId)
    if (result.success) {
      toast.success('Tarea eliminada')
      loadProject()
    } else {
      toast.error(result.error)
    }
  }

  function toggleExpand(taskId: string) {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  function formatDueDate(date: Date | null): { text: string; color: string } {
    if (!date) return { text: '', color: '' }
    
    const d = new Date(date)
    if (isToday(d)) return { text: 'Hoy', color: 'text-blue-600' }
    if (isTomorrow(d)) return { text: 'Mañana', color: 'text-blue-600' }
    if (isPast(d)) return { text: format(d, 'd MMM', { locale: es }), color: 'text-red-600' }
    return { text: format(d, 'd MMM', { locale: es }), color: 'text-gray-600' }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  if (!project) return null

  const completedTasks = project.tasks.filter(t => t.status === 'DONE').length

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
            style={{ backgroundColor: project.color || '#3b82f6' }}
          >
            {project.icon || '📁'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {project.tasks.length > 0 && (
        <div className="flex gap-4 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(completedTasks / project.tasks.length) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground">
              {completedTasks}/{project.tasks.length} completadas
            </span>
          </div>
        </div>
      )}

      {project.tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No hay tareas en este proyecto. Crea la primera tarea.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Tarea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {project.tasks.map((task) => (
            <Card key={task.id} className={task.status === 'DONE' ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleTask(task.id, task.status)}
                    className="mt-0.5"
                  >
                    {task.status === 'DONE' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </span>
                      {task.priority !== 'NONE' && (
                        <Badge className={priorityColors[task.priority]}>
                          {priorityLabels[task.priority]}
                        </Badge>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 ${formatDueDate(task.dueDate).color}`}>
                          <Calendar className="h-3 w-3" />
                          {formatDueDate(task.dueDate).text}
                        </span>
                      )}
                      {task.subtasks.length > 0 && (
                        <span className="text-muted-foreground">
                          {task.subtasks.filter(s => s.status === 'DONE').length}/{task.subtasks.length} subtareas
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {task.subtasks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(task.id)}
                      >
                        {expandedTasks.has(task.id) ? 'Ocultar' : `Ver ${task.subtasks.length}`}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSubtaskDialogOpen(task.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                {expandedTasks.has(task.id) && task.subtasks.length > 0 && (
                  <div className="mt-3 ml-8 space-y-2 border-l-2 border-muted pl-4">
                    {task.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2">
                        <button onClick={() => handleToggleTask(subtask.id, subtask.status)}>
                          {subtask.status === 'DONE' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300" />
                          )}
                        </button>
                        <span className={`text-sm ${subtask.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                          {subtask.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto"
                          onClick={() => handleDeleteTask(subtask.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateTask}
      />

      <TaskDialog
        open={!!subtaskDialogOpen}
        onOpenChange={(open) => setSubtaskDialogOpen(open ? subtaskDialogOpen : null)}
        onSubmit={(data) => subtaskDialogOpen && handleCreateSubtask(subtaskDialogOpen, data)}
        isSubtask
      />
    </div>
  )
}