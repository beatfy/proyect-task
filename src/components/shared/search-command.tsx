'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Folder, Tag, Search } from 'lucide-react'
import { searchNotes } from '@/actions/notes'
import { getFolders } from '@/actions/folders'
import { getTags } from '@/actions/tags'
import type { NoteWithTags, Folder as FolderType, Tag as TagType } from '@/types'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

interface SearchCommandProps {
  children: React.ReactNode
}

export function SearchCommand({ children }: SearchCommandProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [notes, setNotes] = React.useState<NoteWithTags[]>([])
  const [folders, setFolders] = React.useState<FolderType[]>([])
  const [tags, setTags] = React.useState<TagType[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(open => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  React.useEffect(() => {
    if (open) {
      // Load folders and tags on open
      const loadData = async () => {
        const [foldersResult, tagsResult] = await Promise.all([
          getFolders(),
          getTags(),
        ])
        if (foldersResult.success && foldersResult.data) {
          setFolders(foldersResult.data)
        }
        if (tagsResult.success && tagsResult.data) {
          setTags(tagsResult.data.map(t => ({ ...t, _count: t._count })))
        }
      }
      loadData()
    }
  }, [open])

  React.useEffect(() => {
    const searchDebounced = setTimeout(async () => {
      if (query.length > 0) {
        setLoading(true)
        const result = await searchNotes(query)
        if (result.success && result.data) {
          setNotes(result.data)
        }
        setLoading(false)
      } else {
        setNotes([])
      }
    }, 300)

    return () => clearTimeout(searchDebounced)
  }, [query])

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar notas, carpetas, etiquetas..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Buscando...
            </div>
          )}
          <CommandEmpty>
            {query.length > 0 ? 'No se encontraron resultados.' : 'Escribe para buscar...'}
          </CommandEmpty>

          {notes.length > 0 && (
            <CommandGroup heading="Notas">
              {notes.slice(0, 5).map(note => (
                <CommandItem
                  key={note.id}
                  onSelect={() => {
                    router.push(`/notes/${note.id}`)
                    setOpen(false)
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{note.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {query.length === 0 && folders.length > 0 && (
            <>
              {notes.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Carpetas">
                {folders.slice(0, 5).map(folder => (
                  <CommandItem
                    key={folder.id}
                    onSelect={() => {
                      router.push(`/notes?folder=${folder.id}`)
                      setOpen(false)
                    }}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{folder.icon || '📁'} {folder.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {query.length === 0 && tags.length > 0 && (
            <>
              {(notes.length > 0 || folders.length > 0) && <CommandSeparator />}
              <CommandGroup heading="Etiquetas">
                {tags.slice(0, 5).map(tag => (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => {
                      router.push(`/notes?tag=${tag.id}`)
                      setOpen(false)
                    }}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    <span>{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}