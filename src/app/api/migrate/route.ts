import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Create tables using Prisma's raw execute
    
    // Users table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        image TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Notes table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        "isFavorite" BOOLEAN DEFAULT FALSE,
        "isArchived" BOOLEAN DEFAULT FALSE,
        "isDeleted" BOOLEAN DEFAULT FALSE,
        "deletedAt" TIMESTAMP,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "folderId" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Folders table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Tags table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        color TEXT,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Note tags junction table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS note_tags (
        "noteId" TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        "tagId" TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY ("noteId", "tagId")
      )
    `)
    
    // Projects table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT,
        "isArchived" BOOLEAN DEFAULT FALSE,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Tasks table (using strings instead of enums for compatibility)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'TODO',
        priority TEXT DEFAULT 'NONE',
        "dueDate" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "isArchived" BOOLEAN DEFAULT FALSE,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "projectId" TEXT REFERENCES projects(id) ON DELETE SET NULL,
        "parentId" TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // Create indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS notes_userId_idx ON notes("userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS notes_folderId_idx ON notes("folderId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tasks_userId_idx ON tasks("userId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tasks_projectId_idx ON tasks("projectId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tasks_parentId_idx ON tasks("parentId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS projects_userId_idx ON projects("userId")`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully!',
      tables: ['users', 'notes', 'folders', 'tags', 'note_tags', 'projects', 'tasks']
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}