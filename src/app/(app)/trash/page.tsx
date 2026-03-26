'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getNotes, restoreNote, permanentDeleteNote } from '@/actions/notes'
import type { NoteWithTags } from '@/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TrashPage() {
  const [notes, setNotes] = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrash()
  }, [])

  async function loadTrash() {
    setLoading(true)
    const result = await getNotes({ includeDeleted: true })
    if (result.success) {
      setNotes(result.data!.filter(n => n.isDeleted))
    }
    setLoading(false)
  }

  async function handleRestore(noteId: string) {
    const result = await restoreNote(noteId)
    if (result.success) {
      toast.success('Nota restaurada')
      loadTrash()
    } else {
      toast.error('Error al restaurar la nota')
    }
  }

  async function handlePermanentDelete(noteId: string) {
    const result = await permanentDeleteNote(noteId)
    if (result.success) {
      toast.success('Nota eliminada permanentemente')
      loadTrash()
    } else {
      toast.error('Error al eliminar la nota')
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Papelera</h1>
          <p className="text-muted-foreground mt-1">
            Notas eliminadas. Se eliminan permanentemente después de 30 días.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              La papelera está vacía.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{note.title}</h3>
                      {note.isFavorite && (
                        <Badge variant="secondary" className="text-xs">
                          <Trash2 className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(note.deletedAt!), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </Badge>
                      )}
                    </div>
                    {note.excerpt && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {note.excerpt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(note.id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restaurar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <X className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            ¿Eliminar permanentemente?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La nota "{note.title}" será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handlePermanentDelete(note.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar permanentemente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}