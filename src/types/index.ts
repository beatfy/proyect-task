import { Note, Folder, Tag, User } from '@prisma/client'

// Base types from Prisma
export type { Note, Folder, Tag, User }

// Note with relations
export interface NoteWithTags extends Note {
  tags: Array<{ tag: Tag }>
  folder?: Folder | null
}

// Folder with note count
export interface FolderWithNotes extends Folder {
  _count?: {
    notes: number
  }
}

// Tag with note count
export interface TagWithNotes extends Tag {
  _count?: {
    notes: number
  }
}

// Dashboard stats
export interface DashboardStats {
  totalNotes: number
  favoriteNotes: number
  archivedNotes: number
  deletedNotes: number
  totalFolders: number
  totalTags: number
}

// Search result
export interface SearchResult {
  notes: NoteWithTags[]
  folders: Folder[]
  tags: Tag[]
}

// API response types
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Form state for forms
export interface FormState {
  success: boolean
  message?: string
  errors?: Record<string, string[]>
}

// User session data
export interface UserSession {
  id: string
  email: string
  name?: string | null
  image?: string | null
}