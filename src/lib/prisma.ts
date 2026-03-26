import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if using Prisma Postgres URL format (prisma+postgres://)
const databaseUrl = process.env.DATABASE_URL || ''
const isPrismaPostgresUrl = databaseUrl.startsWith('prisma+postgres://')

function createPrismaClient() {
  if (isPrismaPostgresUrl) {
    // For Prisma Postgres/Accelerate URLs, pass as accelerateUrl
    return new PrismaClient({
      accelerateUrl: databaseUrl,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }
  
  // For regular PostgreSQL URLs, use the adapter pattern
  const connectionString = databaseUrl
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma