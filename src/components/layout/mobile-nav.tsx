'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Plus, Home, FileText, FolderOpen, Trash2, Settings, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UserButton } from '@clerk/nextjs'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Notas', href: '/notes', icon: FileText },
  { name: 'Favoritos', href: '/notes?favorites=true', icon: Star },
  { name: 'Carpetas', href: '/folders', icon: FolderOpen },
  { name: 'Papelera', href: '/trash', icon: Trash2 },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

interface MobileNavProps {
  currentPath: string
}

export function MobileNav({ currentPath }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="lg:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-md border bg-background shadow-sm"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menú</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <nav className="absolute inset-y-0 left-0 w-72 bg-background border-r shadow-xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex h-16 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                    X
                  </div>
                  <span className="text-xl font-semibold">Xnote</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {navigation.map(item => {
                    const isActive = currentPath === item.href || 
                      (item.href !== '/dashboard' && currentPath.startsWith(item.href.split('?')[0]))
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t p-4 space-y-4">
                <Link href="/notes/new" onClick={() => setIsOpen(false)}>
                  <Button className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Nota
                  </Button>
                </Link>
                <div className="flex items-center justify-center">
                  <UserButton />
                </div>
              </div>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}