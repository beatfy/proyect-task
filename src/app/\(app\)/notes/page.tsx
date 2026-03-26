'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Star, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getNotes, searchNotes } from '@/actions/notes'
import type { NoteWithTags } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

function NotesList() {
  const searchParams = useSearchParams()
  const showFavorites = searchParams.get('favorites') === 'true'
  
  const [notes, setNotes] = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [showFavorites])

  async function loadNotes() {
    setLoading(true)
    const result = await getNotes({
      favoritesOnly: showFavorites || undefined,
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

  const filteredNotes = notes.filter(n => !n.isArchived && !n.isDeleted)

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {showFavorites ? 'Favoritos' : 'Notas'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {showFavorites
              ? 'Tus notas marcadas como favoritas'
              : 'Todas tus notas'}
          </p>
        </div>
        <Link href="/notes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Nota
          </Button>
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {/* Notes Grid */}
      {loading || isSearching ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? 'No se encontraron notas con ese término'
                : showFavorites
                ? 'No tienes notas favoritas'
                : 'No tienes notas. ¡Crea tu primera nota!'}
            </p>
            {!searchQuery && (
              <Link href="/notes/new">
                <Button className="mt-4">
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
            <Link key={note.id} href={`/notes/${note.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold line-clamp-1">{note.title}</h3>
                    {note.isFavorite && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                  </div>
                  {note.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {note.excerpt}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {note.tags.slice(0, 3).map(({ tag }) => (
                        <Badge key={tag.id} variant="secondary" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.updatedAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <NotesList />
    </Suspense>
  )
}