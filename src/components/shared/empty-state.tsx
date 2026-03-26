import { FileText, FolderOpen, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  type: 'notes' | 'favorites' | 'folders' | 'trash' | 'search'
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

const icons = {
  notes: FileText,
  favorites: Star,
  folders: FolderOpen,
  trash: Trash2,
  search: FileText,
}

export function EmptyState({ type, title, description, action }: EmptyStateProps) {
  const Icon = icons[type]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      {action && (
        <Button asChild={!!action.href} onClick={action.onClick}>
          {action.href ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            <span>{action.label}</span>
          )}
        </Button>
      )}
    </div>
  )
}