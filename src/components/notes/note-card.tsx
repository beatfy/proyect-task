'use client'

import Link from 'next/link'
import { Star, MoreVertical, Trash2, Archive, FolderOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NoteWithTags } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface NoteCardProps {
  note: NoteWithTags
  onToggleFavorite?: (noteId: string) => void
  onDelete?: (noteId: string) => void
  onArchive?: (noteId: string) => void
}

export function NoteCard({ note, onToggleFavorite, onDelete, onArchive }: NoteCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow h-full group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Link href={`/notes/${note.id}`} className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-1 hover:text-primary transition-colors">
              {note.title}
            </h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {note.isFavorite && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                />}>
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onToggleFavorite?.(note.id)}>
                  <Star className="mr-2 h-4 w-4" />
                  {note.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive?.(note.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {note.isArchived ? 'Desarchivar' : 'Archivar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete?.(note.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Mover a papelera
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {note.excerpt && (
          <Link href={`/notes/${note.id}`}>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {note.excerpt}
            </p>
          </Link>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 flex-wrap flex-1 min-w-0">
            {note.tags.slice(0, 3).map(({ tag }) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{note.tags.length - 3}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(note.updatedAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>
        </div>

        {note.folder && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t">
            <FolderOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{note.folder.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}