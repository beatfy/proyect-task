'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteCard } from './note-card'
import { getNotes, searchNotes, updateNote, deleteNote } from '@/actions/notes'
import type { NoteWithTags } from '@/types'
import { toast } from 'sonner'

interface NoteListProps {
  favoritesOnly?: boolean
  folderId?: string
  showSearch?: boolean
  emptyMessage?: string
}

export function NoteList({
  favoritesOnly = false,
  folderId,
  showSearch = true,
  emptyMessage = 'No tienes notas. ¡Crea tu primera nota!',
}: NoteListProps) {
  const [notes, setNotes] = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [favoritesOnly, folderId])

  async function loadNotes() {
    setLoading(true)
    const result = await getNotes({
      favoritesOnly: favoritesOnly || undefined,
      folderId,
    })
    if (result.success) {
      setNotes(result.data!)
    }
    setLoading(false)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      loadNotes()
      return
    }

    setIsSearching(true)
    const result = await searchNotes(searchQuery)
    if (result.success) {
      setNotes(result.data!)
    }
    setIsSearching(false)
  }

  async function handleToggleFavorite(noteId: string) {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    const result = await updateNote(noteId, { isFavorite: !note.isFavorite })
    if (result.success) {
      setNotes(notes.map(n => n.id === noteId ? result.data! : n))
      toast.success(note.isFavorite ? 'Eliminado de favoritos' : 'Añadido a favoritos')
    } else {
      toast.error('Error al actualizar la nota')
    }
  }

  async function handleDelete(noteId: string) {
    const result = await deleteNote(noteId)
    if (result.success) {
      setNotes(notes.filter(n => n.id !== noteId))
      toast.success('Nota movida a la papelera')
    } else {
      toast.error('Error al eliminar la nota')
    }
  }

  async function handleArchive(noteId: string) {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    const result = await updateNote(noteId, { isArchived: !note.isArchived })
    if (result.success) {
      setNotes(notes.map(n => n.id === noteId ? result.data! : n))
      toast.success(note.isArchived ? 'Nota desarchivada' : 'Nota archivada')
    } else {
      toast.error('Error al archivar la nota')
    }
  }

  const filteredNotes = notes.filter(n => !n.isArchived && !n.isDeleted)

  if (loading || isSearching) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      {showSearch && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      )}

      {/* Notes Grid or Empty State */}
      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? 'No se encontraron notas con ese término'
                : emptyMessage}
            </p>
            {!searchQuery && (
              <Link href="/notes/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Nota
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  )
}