'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, MoreVertical, Edit, Trash2, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getFolders, deleteFolder } from '@/actions/folders'
import type { FolderWithNotes } from '@/types'
import { toast } from 'sonner'

interface FolderListProps {
  onEdit?: (folder: FolderWithNotes) => void
  onDelete?: (folderId: string) => void
}

export function FolderList({ onEdit, onDelete }: FolderListProps) {
  const [folders, setFolders] = useState<FolderWithNotes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFolders()
  }, [])

  async function loadFolders() {
    setLoading(true)
    const result = await getFolders()
    if (result.success) {
      setFolders(result.data!)
    }
    setLoading(false)
  }

  async function handleDelete(folderId: string) {
    const result = await deleteFolder(folderId)
    if (result.success) {
      toast.success('Carpeta eliminada')
      setFolders(folders.filter(f => f.id !== folderId))
      onDelete?.(folderId)
    } else {
      toast.error('Error al eliminar la carpeta')
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No tienes carpetas. Crea tu primera carpeta para organizar tus notas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <Card key={folder.id} className="hover:shadow-md transition-shadow group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Link
                href={`/notes?folder=${folder.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: folder.color || '#3b82f6' }}
                >
                  <FolderOpen className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{folder.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {folder._count?.notes ?? 0} notas
                  </p>
                </div>
              </Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />}>
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(folder)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDelete(folder.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}