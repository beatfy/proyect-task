'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { auth } from '@clerk/nextjs/client'
import { redirect } from 'next/navigation'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-72">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  )
}