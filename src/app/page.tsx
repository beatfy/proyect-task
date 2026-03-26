'use client'

import Link from 'next/link'
import { ArrowRight, Check, FileText, Folder, Search, Star, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@clerk/nextjs'
import { useTheme } from 'next-themes'

const features = [
  {
    icon: FileText,
    title: 'Notas Rich-Text',
    description: 'Editor moderno con soporte para formato, listas, código y más.',
  },
  {
    icon: Folder,
    title: 'Organización',
    description: 'Carpetas y etiquetas para mantener todo ordenado.',
  },
  {
    icon: Star,
    title: 'Favoritos',
    description: 'Marca tus notas importantes para acceso rápido.',
  },
  {
    icon: Search,
    title: 'Búsqueda Potente',
    description: 'Encuentra cualquier nota al instante con búsqueda full-text.',
  },
]

const pricing = [
  {
    name: 'Gratis',
    price: '0€',
    description: 'Perfecto para empezar',
    features: ['Notas ilimitadas', 'Hasta 10 carpetas', 'Búsqueda full-text', 'Sincronización en tiempo real'],
  },
  {
    name: 'Pro',
    price: '9€',
    period: '/mes',
    description: 'Para usuarios avanzados',
    features: ['Todo en Gratis', 'Carpetas ilimitadas', 'Versiones de notas', 'Exportar a PDF/Markdown', 'Soporte prioritario'],
    popular: true,
  },
]

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const { isSignedIn } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-sm z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              X
            </div>
            <span className="text-xl font-semibold">Xnote</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {!isSignedIn && (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost">Iniciar Sesión</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>Registrarse</Button>
                </Link>
              </>
            )}
            {isSignedIn && (
              <Link href="/dashboard">
                <Button>
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-32 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Tus notas, organizadas y hermosas
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Xnote es la app de notas moderna que necesitas. Escribe, organiza y encuentra
            tus ideas en segundos. Simple, rápido y elegante.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            {!isSignedIn && (
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8">
                  Empezar Gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            {isSignedIn && (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8">
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Preview Image/Screenshot */}
        <div className="mt-16 mx-auto max-w-5xl">
          <div className="rounded-xl border bg-muted/50 p-2 shadow-2xl">
            <div className="rounded-lg bg-background aspect-video flex items-center justify-center">
              <div className="text-center p-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center">
                    X
                  </div>
                  <span className="text-2xl font-semibold">Xnote</span>
                </div>
                <p className="text-muted-foreground">Preview del Dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Todo lo que necesitas</h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Planes simples</h2>
        <p className="text-muted-foreground text-center mb-12">Sin sorpresas. Sin compromisos.</p>
        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border bg-card p-8 ${
                plan.popular ? 'border-primary shadow-lg' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                    Popular
                  </span>
                </div>
              )}
              <h3 className="font-semibold text-xl">{plan.name}</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground ml-1">{plan.period}</span>
                )}
              </div>
              <p className="text-muted-foreground mt-2">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-8"
                variant={plan.popular ? 'default' : 'outline'}
              >
                Empezar
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-2xl bg-primary/5 border p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">¿Listo para organizar tus ideas?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Únete a miles de usuarios que ya usan Xnote para ser más productivos.
          </p>
          {!isSignedIn && (
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          {isSignedIn && (
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8">
                Ir al Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
              X
            </div>
            <span className="font-semibold">Xnote</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Xnote. Hecho con ❤️
          </p>
        </div>
      </footer>
    </div>
  )
}