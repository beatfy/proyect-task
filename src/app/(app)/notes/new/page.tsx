'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createNote } from '@/actions/notes'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

const NoteEditor = dynamic(
  () => import('@/components/notes/note-editor').then(mod => mod.NoteEditor),
  { ssr: false }
)

export default function NewNotePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    setSaving(true)
    const result = await createNote({
      title,
      content,
    })

    if (result.success && result.data) {
      toast.success('Nota creada')
      router.push(`/notes/${result.data.id}`)
    } else {
      toast.error('Error al crear la nota')
    }
    setSaving(false)
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/notes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la nota..."
        className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0 mb-6"
        autoFocus
      />

      {/* Editor */}
      <div className="min-h-[400px] border rounded-lg">
        <NoteEditor
          content={content}
          onChange={setContent}
        />
      </div>
    </div>
  )
}