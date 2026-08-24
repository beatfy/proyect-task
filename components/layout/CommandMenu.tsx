"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckSquare,
  Timer,
  Droplets,
  Calendar,
  FolderOpen,
  Plus,
  Zap,
  Bot,
  BrainCircuit,
  Receipt,
  Users,
  X,
  Command,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  category: "Tareas" | "Ayuno & Salud" | "Mapas Mentales" | "CRM & Facturación" | "IA";
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void | Promise<void>;
  badge?: string;
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Atajo de teclado global Ctrl+K o Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleQuickWater = async (amountMl: number) => {
    setOpen(false);
    try {
      const res = await fetch("/api/v1/fasting/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMl }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`💧 +${amountMl}ml registrados. Total hoy: ${data.waterDrankMl}ml`);
      }
    } catch {
      toast.error("Error al registrar agua");
    }
  };

  const commands: CommandItem[] = [
    // Tareas
    {
      id: "tasks-kanban",
      category: "Tareas",
      title: "Tablero Kanban de Tareas",
      subtitle: "Ver y organizar tus tareas en columnas",
      icon: CheckSquare,
      action: () => { router.push("/tasks"); setOpen(false); },
    },
    {
      id: "calendar-view",
      category: "Tareas",
      title: "Calendario de Entregas",
      subtitle: "Vista mensual y semanal de fechas límite",
      icon: Calendar,
      action: () => { router.push("/calendar"); setOpen(false); },
    },
    {
      id: "projects-list",
      category: "Tareas",
      title: "Proyectos Activos",
      subtitle: "Gestionar proyectos y miembros de equipo",
      icon: FolderOpen,
      action: () => { router.push("/projects"); setOpen(false); },
    },

    // Ayuno & Salud
    {
      id: "fasting-timer",
      category: "Ayuno & Salud",
      title: "Cronómetro de Ayuno Intermitente",
      subtitle: "Ver estado metabólico, fases y objetivo",
      icon: Timer,
      badge: "Salud",
      action: () => { router.push("/fasting"); setOpen(false); },
    },
    {
      id: "water-250",
      category: "Ayuno & Salud",
      title: "Registrar +250ml de Agua (1 Vaso)",
      subtitle: "Suma un vaso de agua al objetivo diario",
      icon: Droplets,
      action: () => handleQuickWater(250),
    },
    {
      id: "water-500",
      category: "Ayuno & Salud",
      title: "Registrar +500ml de Agua (1 Botella)",
      subtitle: "Suma una botella de agua al objetivo diario",
      icon: Droplets,
      action: () => handleQuickWater(500),
    },
    {
      id: "doc-ai",
      category: "Ayuno & Salud",
      title: "Consultar a Doc IA",
      subtitle: "Médico especialista en ayuno y nutrición",
      icon: Bot,
      action: () => { router.push("/fasting"); setOpen(false); },
    },

    // Mapas Mentales
    {
      id: "mindmaps",
      category: "Mapas Mentales",
      title: "Mapas Mentales & Brainstorming",
      subtitle: "Crear y organizar ideas en nodos conectados",
      icon: BrainCircuit,
      action: () => { router.push("/mindmaps"); setOpen(false); },
    },

    // CRM & Facturación
    {
      id: "crm-contacts",
      category: "CRM & Facturación",
      title: "Contactos & Clientes CRM",
      subtitle: "Base de datos y seguimiento de clientes",
      icon: Users,
      action: () => { router.push("/crm/contacts"); setOpen(false); },
    },
    {
      id: "crm-pipeline",
      category: "CRM & Facturación",
      title: "Pipeline de Oportunidades",
      subtitle: "Flujo de ventas y acuerdos comerciales",
      icon: Zap,
      action: () => { router.push("/crm/pipeline"); setOpen(false); },
    },
    {
      id: "billing-invoices",
      category: "CRM & Facturación",
      title: "Facturación & Cobros Recurrentes",
      subtitle: "Generar facturas y estado de cobros",
      icon: Receipt,
      action: () => { router.push("/billing"); setOpen(false); },
    },

    // IA
    {
      id: "agents-chat",
      category: "IA",
      title: "Chatear con Agentes IA",
      subtitle: "Asistentes de marketing, código y gestión",
      icon: Bot,
      action: () => { router.push("/chat"); setOpen(false); },
    },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()) ||
          (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase()))
      )
    : commands;

  const categories = Array.from(new Set(filtered.map((c) => c.category)));

  return (
    <>
      {/* Botón flotante móvil (FAB) en la esquina inferior derecha */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-40 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-primary/20"
          aria-label="Abrir Menú de Comandos"
        >
          <Command className="w-5 h-5" />
        </button>
      </div>

      {/* Modal de Comandos Global */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-16 md:pt-24 animate-in fade-in duration-150">
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-border gap-3 bg-muted/20">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe un comando o busca una sección... (ej: agua, tareas, ayuno)"
                className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground font-medium"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Results Grouped by Category */}
            <div className="overflow-y-auto p-2 space-y-4 divide-y divide-border/50">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron acciones para &quot;{query}&quot;
                </div>
              ) : (
                categories.map((cat) => {
                  const catItems = filtered.filter((i) => i.category === cat);
                  return (
                    <div key={cat} className="pt-2 first:pt-0 space-y-1">
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                        {cat}
                      </div>
                      {catItems.map((item) => {
                        const IconComp = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => item.action()}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted/70 flex items-center gap-3 transition-colors group cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate">
                                {item.title}
                              </div>
                              {item.subtitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                            {item.badge && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Tips */}
            <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">Ctrl+K</kbd> para abrir en cualquier lugar
              </span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">Esc</kbd> para cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
