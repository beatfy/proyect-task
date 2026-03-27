'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FileText,
  FolderOpen,
  Trash2,
  Settings,
  Plus,
  Menu,
  X,
  Star,
  Layout,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Proyectos', href: '/projects', icon: Layout },
  { name: 'Tareas', href: '/tasks', icon: CheckSquare },
  { name: 'Notas', href: '/notes', icon: FileText },
  { name: 'Favoritos', href: '/notes?favorites=true', icon: Star },
  { name: 'Carpetas', href: '/folders', icon: FolderOpen },
  { name: 'Papelera', href: '/trash', icon: Trash2 },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          X
        </div>
        <span className="text-xl font-semibold">Xnote</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navigation.map(item => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname?.startsWith(item.href.split('?')[0]))
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
      </nav>

      {/* New Button */}
      <div className="border-t p-4 space-y-2">
        <Link href="/projects" className="block">
          <Button className="w-full" variant="default" onClick={() => setMobileOpen(false)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proyecto
          </Button>
        </Link>
        <Link href="/notes/new" className="block">
          <Button className="w-full" variant="outline" onClick={() => setMobileOpen(false)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Nota
          </Button>
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <span className="sr-only">Abrir menú</span>
        {mobileOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-background border-r">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-72 lg:flex-col border-r bg-background">
        <SidebarContent />
      </aside>
    </>
  )
}