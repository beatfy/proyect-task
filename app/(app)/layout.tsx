"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FolderOpen, CheckSquare, Calendar, Settings, LogOut,
  ChevronLeft, ChevronRight, Mail, Sun, Moon, Building2,
  Menu, Receipt, Bot, ChevronDown, BarChart3, Search, Megaphone,
  TrendingUp, Share2, Users, Kanban, Globe
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
  { name: "SEO Agent", href: "/agents/seo-agent", icon: Search },
  { name: "SEM Agent", href: "/agents/sem-agent", icon: TrendingUp },
  { name: "Social Agent", href: "/agents/social-agent", icon: Share2 },
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
    label: "Trabajo",
    items: [
      { name: "Clientes", href: "/projects", icon: FolderOpen },
      { name: "Tareas", href: "/tasks", icon: CheckSquare },
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--mediterranean-sand)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--mediterranean-terracotta)]"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-card border-b border-border flex items-center justify-between px-4">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="text-lg font-bold text-[var(--mediterranean-terracotta)]">
            {process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject"}
          </Link>
          <NotificationCenter compact />
        </header>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col",
            "md:translate-x-0",
            mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
            collapsed ? "md:w-[68px]" : "md:w-64"
          )}
        >
          {/* Logo / Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-border flex-shrink-0",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            {!collapsed && (
              <Link href="/dashboard" className="text-xl font-bold text-[var(--mediterranean-terracotta)]">
                {process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject"}
              </Link>
            )}
            {collapsed && (
              <Link href="/dashboard" className="text-lg font-bold text-[var(--mediterranean-terracotta)]">
                {(process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject")[0]}
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
                    className="h-8 w-8 text-foreground hover:text-foreground"
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
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {sections.map((section, sIdx) => (
              <div key={section.label}>
                {sIdx > 0 && (
                  <div className={cn(
                    "my-2 border-t border-foreground/10",
                    collapsed && "mx-1"
                  )} />
                )}
                {!collapsed && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase proyectoing-wider text-muted-foreground/60">
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
                        "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        isActive
                          ? "sidebar-item-active"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && item.name}
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
          <div className="border-t border-border p-2 flex-shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-full bg-[var(--mediterranean-terracotta)] text-white flex items-center justify-center text-sm font-medium hover:opacity-90 transition-opacity">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-medium">{session.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                      {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-[var(--mediterranean-terracotta)] text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user?.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
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
          <div className="p-4 md:p-6 pb-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
