'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, CheckCircle, Circle, Calendar, AlertCircle, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getTasks, createTask, updateTask, deleteTask, getProjects } from '@/actions/tasks'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { toast } from 'sonner'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  completedAt: Date | null
  projectId: string | null
  project: { id: string; name: string; color: string | null } | null
  subtasks: Task[]
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  useEffect(() => {
    loadTasks()
  }, [statusFilter, priorityFilter])

  async function loadTasks() {
    setLoading(true)
    const filters: any = {}
    if (statusFilter !== 'all') filters.status = statusFilter
    if (priorityFilter !== 'all') filters.priority = priorityFilter
    
    const result = await getTasks(filters)
    if (result.success) {
      setTasks(result.data!)
    }
    setLoading(false)
  }

  async function handleCreateTask(data: { title: string; description?: string; priority?: string; dueDate?: Date }) {
    const result = await createTask(data)
    if (result.success) {
      toast.success('Tarea creada')
      setDialogOpen(false)
      loadTasks()
    } else {
      toast.error(result.error)
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE'
    const result = await updateTask(taskId, { status: newStatus })
    if (result.success) {
      loadTasks()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDeleteTask(taskId: string) {
    const result = await deleteTask(taskId)
    if (result.success) {
      toast.success('Tarea eliminada')
      loadTasks()
    } else {
      toast.error(result.error)
    }
  }

  function formatDueDate(date: Date | null): { text: string; color: string } {
    if (!date) return { text: '', color: '' }
    
    const d = new Date(date)
    if (isToday(d)) return { text: 'Hoy', color: 'text-blue-600' }
    if (isTomorrow(d)) return { text: 'Mañana', color: 'text-blue-600' }
    if (isPast(d)) return { text: format(d, 'd MMM', { locale: es }), color: 'text-red-600' }
    return { text: format(d, 'd MMM', { locale: es }), color: 'text-gray-600' }
  }

  // Group tasks by status
  const groupedTasks = {
    TODO: tasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    DONE: tasks.filter(t => t.status === 'DONE'),
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tareas</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona todas tus tareas en un solo lugar
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Tarea
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="TODO">Por hacer</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="DONE">Completado</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="URGENT">Urgente</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Media</SelectItem>
            <SelectItem value="LOW">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No tienes tareas. Crea tu primera tarea para comenzar.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Tarea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Todo */}
          {groupedTasks.TODO.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Circle className="h-5 w-5 text-gray-400" />
                Por hacer ({groupedTasks.TODO.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.TODO.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleToggleTask(task.id, task.status)}>
                          <Circle className="h-5 w-5 text-gray-300 hover:text-gray-400" />
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{task.title}</span>
                            {task.priority !== 'NONE' && (
                              <Badge className={priorityColors[task.priority]}>
                                {priorityLabels[task.priority]}
                              </Badge>
                            )}
                            {task.project && (
                              <Link
                                href={`/projects/${task.project.id}`}
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                📁 {task.project.name}
                              </Link>
                            )}
                          </div>
                          {task.dueDate && (
                            <span className={`text-sm ${formatDueDate(task.dueDate).color} flex items-center gap-1 mt-1`}>
                              <Calendar className="h-3 w-3" />
                              {formatDueDate(task.dueDate).text}
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                          ×
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {groupedTasks.IN_PROGRESS.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Circle className="h-5 w-5 text-blue-500" />
                En progreso ({groupedTasks.IN_PROGRESS.length})
              </h2>
              <div className="space-y-2">
                {groupedTasks.IN_PROGRESS.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleToggleTask(task.id, task.status)}>
                          <Circle className="h-5 w-5 text-blue-500" />
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{task.title}</span>
                            {task.priority !== 'NONE' && (
                              <Badge className={priorityColors[task.priority]}>
                                {priorityLabels[task.priority]}
                              </Badge>
                            )}
                          </div>
                          {task.dueDate && (
                            <span className={`text-sm ${formatDueDate(task.dueDate).color} flex items-center gap-1 mt-1`}>
                              <Calendar className="h-3 w-3" />
                              {formatDueDate(task.dueDate).text}
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)}>
                          ×
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {groupedTasks.DONE.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completado ({groupedTasks.DONE.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {groupedTasks.DONE.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleToggleTask(task.id, task.status)}>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </button>
                        <span className="font-medium line-through">{task.title}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)} className="ml-auto">
                          ×
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateTask}
      />
    </div>
  )
}