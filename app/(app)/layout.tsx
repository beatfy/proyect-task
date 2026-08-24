"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FolderOpen, CheckSquare, Calendar, Settings, LogOut,
  ChevronLeft, ChevronRight, Mail, Sun, Moon, Building2,
  Menu, Receipt, Bot, ChevronDown, BarChart3, Search, Megaphone,
  TrendingUp, Share2, Users, Kanban, Globe, BookOpen, Brain, Clock, Sparkles, Network
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const agentItems = [
  { name: "Doc", href: "/agents/doc", icon: Brain },
];

const sections = [
  {
    label: "General",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Home },
      { name: "Agencias", href: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Salud & Bienestar",
    items: [
      { name: "Ayuno Intermitente", href: "/fasting", icon: Clock },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { name: "Proyectos", href: "/projects", icon: FolderOpen },
      { name: "Tareas", href: "/tasks", icon: CheckSquare },
      { name: "Focus Flow", href: "/focus", icon: Brain },
      { name: "Mapas Mentales", href: "/mindmaps", icon: Network },
      { name: "Calendario", href: "/calendar", icon: Calendar },
      { name: "Mail", href: "/mail", icon: Mail },
    ],
  },
  {
    label: "Agentes IA",
    items: agentItems,
  },
  {
    label: "Negocio",
    items: [
      { name: "CRM", href: "/crm", icon: Users },
      { name: "Oportunidades", href: "/crm/pipeline", icon: Kanban },
      { name: "Facturación", href: "/billing", icon: Receipt },
      { name: "Reportes", href: "/reports", icon: BarChart3 },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <Sparkles className="h-4 w-4 text-indigo-400 absolute" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background relative selection:bg-indigo-500/30">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 backdrop-blur-xl bg-slate-900/80 dark:bg-slate-950/80 border-b border-white/10 flex items-center justify-between px-4">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 font-black text-lg text-gradient-indigo">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs shadow-md shadow-indigo-600/30">
              ⚡
            </div>
            <span>{brandName}</span>
          </Link>
          <NotificationCenter compact />
        </header>

        {/* Glassmorphic Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen backdrop-blur-2xl bg-slate-900/70 dark:bg-slate-950/80 border-r border-white/10 transition-all duration-300 flex flex-col shadow-2xl",
            "md:translate-x-0",
            mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
            collapsed ? "md:w-[68px]" : "md:w-64"
          )}
        >
          {/* Logo / Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-white/10 flex-shrink-0 px-4",
            collapsed ? "justify-center px-2" : "justify-between"
          )}>
            {!collapsed && (
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-lg font-black tracking-tight text-gradient-indigo">
                  {brandName}
                </span>
              </Link>
            )}
            {collapsed && (
              <Link href="/dashboard" className="flex items-center justify-center">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/30">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
              </Link>
            )}
            <div className={cn("flex items-center gap-1", !collapsed && "ml-auto")}>
              {!collapsed && <NotificationCenter compact />}
              {collapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <NotificationCenter compact />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">Notificaciones</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                  >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-hide">
            {sections.map((section, sIdx) => (
              <div key={section.label}>
                {sIdx > 0 && (
                  <div className={cn(
                    "my-3 border-t border-white/5",
                    collapsed && "mx-1"
                  )} />
                )}
                {!collapsed && (
                  <p className="px-3 pt-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const linkContent = (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        isActive
                          ? "bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 font-semibold shadow-sm shadow-indigo-500/10"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4.5 w-4.5 flex-shrink-0 transition-transform group-hover:scale-110",
                        isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                      )} />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    );
                  }

                  return <div key={item.name}>{linkContent}</div>;
                })}
              </div>
            ))}
          </nav>

          {/* User section with dropdown */}
          <div className="border-t border-white/10 p-3 flex-shrink-0 bg-slate-950/40">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-600/30 hover:scale-105 transition-transform">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-52 glass-panel border border-white/10 text-slate-100 shadow-2xl">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-bold text-white">{session.user?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{session.user?.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="focus:bg-indigo-600/20 focus:text-indigo-300" onClick={() => router.push("/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-indigo-600/20 focus:text-indigo-300" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                      {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="focus:bg-rose-600/20 focus:text-rose-300 text-rose-400" onClick={() => signOut({ callbackUrl: "/login" })}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/5 transition-all text-left group">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {session.user?.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-slate-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56 mb-2 glass-panel border border-white/10 text-slate-100 shadow-2xl">
                  <DropdownMenuItem className="focus:bg-indigo-600/20 focus:text-indigo-300" onClick={() => router.push("/settings")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-indigo-600/20 focus:text-indigo-300" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="focus:bg-rose-600/20 focus:text-rose-300 text-rose-400" onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main
          className={cn(
            "transition-all duration-300 min-h-screen",
            "ml-0 pt-14 md:pt-0",
            collapsed ? "md:ml-[68px]" : "md:ml-64"
          )}
        >
          <div className="p-4 md:p-8 pb-12 max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
