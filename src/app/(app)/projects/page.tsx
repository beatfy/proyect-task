'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, FolderOpen, MoreVertical, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getProjects, createProject, archiveProject, deleteProject } from '@/actions/tasks'
import { ProjectDialog } from '@/components/projects/project-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  isArchived: boolean
  _count?: { tasks: number }
}

export default function ProjectsPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    const result = await getProjects()
    if (result.success) {
      setActiveProjects(result.data!.active)
      setArchivedProjects(result.data!.archived)
    }
    setLoading(false)
  }

  async function handleCreateProject(data: { name: string; description?: string; color?: string }) {
    const result = await createProject(data)
    if (result.success) {
      toast.success('Proyecto creado')
      setDialogOpen(false)
      loadProjects()
    } else {
      toast.error(result.error)
    }
  }

  async function handleArchiveProject(id: string) {
    const result = await archiveProject(id)
    if (result.success) {
      toast.success('Proyecto archivado')
      loadProjects()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDeleteProject(id: string) {
    const result = await deleteProject(id)
    if (result.success) {
      toast.success('Proyecto eliminado')
      loadProjects()
    } else {
      toast.error(result.error)
    }
  }

  const colorOptions = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus proyectos y tareas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : activeProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No tienes proyectos. Crea tu primer proyecto para comenzar.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Proyecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <Link href={`/projects/${project.id}`} className="flex items-center gap-3 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                        style={{ backgroundColor: project.color || '#3b82f6' }}
                      >
                        {project.icon || '📁'}
                      </div>
                      <div>
                        <h3 className="font-semibold">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project._count?.tasks || 0} tareas
                        </p>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleArchiveProject(project.id)}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archivar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {archivedProjects.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Archivados ({archivedProjects.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedProjects.map((project) => (
                  <Card key={project.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                          style={{ backgroundColor: project.color || '#3b82f6' }}
                        >
                          {project.icon || '📁'}
                        </div>
                        <div>
                          <h3 className="font-semibold">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">Archivado</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProject}
        colorOptions={colorOptions}
      />
    </div>
  )
}