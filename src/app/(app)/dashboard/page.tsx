'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Star, Archive, Trash2, FolderOpen, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getNoteStats, getNotes } from '@/actions/notes'
import type { DashboardStats, NoteWithTags } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentNotes, setRecentNotes] = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [statsResult, notesResult] = await Promise.all([
        getNoteStats(),
        getNotes({}),
      ])
      
      if (statsResult.success) {
        setStats(statsResult.data!)
      }
      if (notesResult.success) {
        setRecentNotes(notesResult.data!.slice(0, 5))
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const statCards = [
    { name: 'Total Notas', icon: FileText, value: stats?.totalNotes || 0, color: 'text-blue-500' },
    { name: 'Favoritas', icon: Star, value: stats?.favoriteNotes || 0, color: 'text-yellow-500' },
    { name: 'Archivadas', icon: Archive, value: stats?.archivedNotes || 0, color: 'text-purple-500' },
    { name: 'En Papelera', icon: Trash2, value: stats?.deletedNotes || 0, color: 'text-red-500' },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido a Xnote. Aquí tienes un resumen de tus notas.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/notes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Nota
            </Button>
          </Link>
          <Link href="/folders">
            <Button variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              Gestionar Carpetas
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Notes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Notas Recientes</h2>
          <Link href="/notes">
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          </Link>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentNotes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No tienes notas todavía.
              </p>
              <Link href="/notes/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera nota
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{note.title}</h3>
                          {note.isFavorite && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {note.excerpt && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {note.excerpt}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-4 whitespace-nowrap">
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
    </div>
  )
}