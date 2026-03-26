'use client'

import { useState } from 'react'
import { Star, Trash2, Archive, MoreVertical, FolderOpen, Tag, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateNote, deleteNote } from '@/actions/notes'
import { toast } from 'sonner'

interface NoteActionsProps {
  noteId: string
  isFavorite?: boolean
  isArchived?: boolean
  onDelete?: () => void
  onUpdate?: () => void
  showLabel?: boolean
}

export function NoteActions({
  noteId,
  isFavorite = false,
  isArchived = false,
  onDelete,
  onUpdate,
  showLabel = false,
}: NoteActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  async function handleToggleFavorite() {
    setLoading(true)
    const result = await updateNote(noteId, { isFavorite: !isFavorite })
    setLoading(false)
    
    if (result.success) {
      toast.success(isFavorite ? 'Eliminado de favoritos' : 'Añadido a favoritos')
      onUpdate?.()
    } else {
      toast.error('Error al actualizar')
    }
  }

  async function handleToggleArchive() {
    setLoading(true)
    const result = await updateNote(noteId, { isArchived: !isArchived })
    setLoading(false)
    
    if (result.success) {
      toast.success(isArchived ? 'Nota desarchivada' : 'Nota archivada')
      onUpdate?.()
    } else {
      toast.error('Error al actualizar')
    }
  }

  async function handleDelete() {
    setLoading(true)
    const result = await deleteNote(noteId)
    setLoading(false)
    
    if (result.success) {
      toast.success('Nota movida a la papelera')
      setShowDeleteDialog(false)
      onDelete?.()
    } else {
      toast.error('Error al eliminar')
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/notes/${noteId}`
    await navigator.clipboard.writeText(url)
    toast.success('Enlace copiado al portapapeles')
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Favorite Button */}
        <Button
          variant="ghost"
          size={showLabel ? 'default' : 'icon'}
          onClick={handleToggleFavorite}
          disabled={loading}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : ''}`}
          />
          {showLabel && (
            <span className="ml-2">
              {isFavorite ? 'En favoritos' : 'Favorito'}
            </span>
          )}
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleFavorite}>
              <Star className="mr-2 h-4 w-4" />
              {isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={handleToggleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {isArchived ? 'Desarchivar' : 'Archivar'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar enlace
            </DropdownMenuItem>

            <DropdownMenuItem>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir en nueva pestaña
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Mover a papelera
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Mover a papelera?</DialogTitle>
            <DialogDescription>
              La nota se moverá a la papelera y se eliminará permanentemente después de 30 días.
              Puedes restaurarla desde la papelera en cualquier momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Mover a papelera'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}