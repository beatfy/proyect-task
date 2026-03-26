'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star, Trash2, Archive, MoreVertical, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getNote, updateNote, deleteNote } from '@/actions/notes'
import type { NoteWithTags } from '@/types'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Import Tiptap editor dynamically (client-only)
const NoteEditor = dynamic(
  () => import('@/components/notes/note-editor').then(mod => mod.NoteEditor),
  { ssr: false }
)

interface PageProps {
  params: Promise<{ noteId: string }>
}

export default function NotePage({ params }: PageProps) {
  const { noteId } = use(params)
  const router = useRouter()
  
  const [note, setNote] = useState<NoteWithTags | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadNote()
  }, [noteId])

  async function loadNote() {
    setLoading(true)
    const result = await getNote(noteId)
    if (result.success && result.data) {
      setNote(result.data)
      setTitle(result.data.title)
      setContent(result.data.content)
    } else {
      toast.error('Nota no encontrada')
      router.push('/notes')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    setSaving(true)
    const result = await updateNote(noteId, {
      title,
      content,
    })
    
    if (result.success) {
      setNote(result.data!)
      setHasChanges(false)
      toast.success('Nota guardada')
    } else {
      toast.error('Error al guardar la nota')
    }
    setSaving(false)
  }

  async function handleToggleFavorite() {
    if (!note) return
    const result = await updateNote(noteId, {
      isFavorite: !note.isFavorite,
    })
    if (result.success) {
      setNote(result.data!)
      toast.success(note.isFavorite ? 'Eliminado de favoritos' : 'Añadido a favoritos')
    }
  }

  async function handleDelete() {
    const result = await deleteNote(noteId)
    if (result.success) {
      toast.success('Nota movida a la papelera')
      router.push('/notes')
    } else {
      toast.error('Error al eliminar la nota')
    }
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    setHasChanges(true)
  }

  function handleContentChange(newContent: string) {
    setContent(newContent)
    setHasChanges(true)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!note) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <p className="text-muted-foreground">Nota no encontrada</p>
        <Link href="/notes">
          <Button className="mt-4">Volver a Notas</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {note.isFavorite && (
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            )}
            {note.isArchived && (
              <Badge variant="secondary">Archivada</Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
          >
            <Star className={`h-5 w-5 ${note.isFavorite ? 'text-yellow-500 fill-yellow-500' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleFavorite}>
                <Star className="mr-2 h-4 w-4" />
                {note.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Mover a papelera
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={handleTitleChange}
        placeholder="Título de la nota..."
        className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0 mb-6"
      />

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {note.tags.map(({ tag }) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="min-h-[400px] border rounded-lg">
        <NoteEditor
          content={content}
          onChange={handleContentChange}
        />
      </div>
    </div>
  )
}