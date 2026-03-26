'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFolder, updateFolder } from '@/actions/folders'
import type { FolderWithNotes } from '@/types'
import { toast } from 'sonner'

interface FolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: FolderWithNotes | null
  onSuccess?: (folder: FolderWithNotes) => void
}

const colorOptions = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Cian', value: '#06b6d4' },
  { name: 'Índigo', value: '#6366f1' },
]

const iconOptions = ['📁', '📂', '🗂️', '📋', '📝', '💼', '🎯', '⭐', '🔥', '💡']

export function FolderDialog({
  open,
  onOpenChange,
  folder,
  onSuccess,
}: FolderDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [icon, setIcon] = useState('📁')
  const [loading, setLoading] = useState(false)

  const isEditing = !!folder

  useEffect(() => {
    if (folder) {
      setName(folder.name)
      setColor(folder.color || '#3b82f6')
      setIcon(folder.icon || '📁')
    } else {
      setName('')
      setColor('#3b82f6')
      setIcon('📁')
    }
  }, [folder, open])

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    setLoading(true)

    const result = isEditing
      ? await updateFolder(folder.id, { name, color, icon })
      : await createFolder({ name, color, icon })

    setLoading(false)

    if (result.success) {
      toast.success(isEditing ? 'Carpeta actualizada' : 'Carpeta creada')
      onOpenChange(false)
      onSuccess?.(result.data!)
    } else {
      toast.error(result.error || 'Error al guardar la carpeta')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Carpeta' : 'Crear Carpeta'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los detalles de tu carpeta.'
              : 'Crea una nueva carpeta para organizar tus notas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi carpeta"
            />
          </div>

          {/* Color */}
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c.value ? 'scale-110 ring-2 ring-offset-2 ring-foreground' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="grid gap-2">
            <Label>Icono</Label>
            <div className="flex gap-2 flex-wrap">
              {iconOptions.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform ${
                    icon === i ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}