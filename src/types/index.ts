import { Note, Folder, Tag, User } from '@prisma/client'

// Base types from Prisma
export type { Note, Folder, Tag, User }

// Note with relations
export interface NoteWithTags extends Note {
  id: string
  title: string
  content: string
  excerpt?: string | null
  isFavorite: boolean
  isArchived: boolean
  isDeleted: boolean
  deletedAt?: Date | null
  userId: string
  folderId?: string | null
  createdAt: Date
  updatedAt: Date
  tags: Array<{ tag: Tag }>
  folder?: Folder | null
}

// Folder with note count
export interface FolderWithNotes extends Folder {
  id: string
  name: string
  color: string | null
  icon: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
  _count?: {
    notes: number
  }
}

// Tag with note count
export interface TagWithNotes extends Tag {
  id: string
  name: string
  color: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
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