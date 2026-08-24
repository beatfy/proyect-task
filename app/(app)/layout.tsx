"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FolderOpen, CheckSquare, Calendar, Settings, LogOut,
  ChevronLeft, ChevronRight, Mail, Sun, Moon, Building2,
  Menu, Receipt, ChevronDown, BarChart3, Users, Kanban,
  Brain, Clock, Sparkles, Network, Layers
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
    label: "Salud",
    items: [
      { name: "Ayuno Intermitente", href: "/fasting", icon: Clock },
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
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background text-foreground relative selection:bg-primary/20">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 backdrop-blur-md bg-card/90 border-b border-border flex items-center justify-between px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sm">
            <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>{brandName}</span>
          </Link>
          <NotificationCenter compact />
        </header>

        {/* Sleek Minimalist Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen backdrop-blur-xl bg-card/90 dark:bg-card/95 border-r border-border transition-all duration-200 flex flex-col shadow-sm",
            "md:translate-x-0",
            mobileMenuOpen ? "translate-x-0 w-60" : "-translate-x-full w-60",
            collapsed ? "md:w-[60px]" : "md:w-60"
          )}
        >
          {/* Logo / Header */}
          <div
            className={cn(
              "flex items-center h-14 border-b border-border flex-shrink-0 px-3.5",
              collapsed ? "justify-center px-2" : "justify-between"
            )}
          >
            {!collapsed && (
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  {brandName}
                </span>
              </Link>
            )}
            {collapsed && (
              <Link href="/dashboard" className="flex items-center justify-center">
                <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
                  <Layers className="w-4 h-4" />
                </div>
              </Link>
            )}
            <div className={cn("flex items-center gap-1", !collapsed && "ml-auto")}>
              {!collapsed && <NotificationCenter compact />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2.5 space-y-3 overflow-y-auto scrollbar-hide">
            {sections.map((section) => (
              <div key={section.label} className="space-y-0.5">
                {!collapsed && (
                  <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                        "flex items-center gap-2.5 rounded-lg text-xs transition-colors",
                        collapsed ? "justify-center px-2 py-2" : "px-2.5 py-1.5",
                        isActive
                          ? "bg-accent text-accent-foreground font-semibold border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 font-medium"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return <div key={item.name}>{linkContent}</div>;
                })}
              </div>
            ))}
          </nav>

          {/* User section with dropdown */}
          <div className="border-t border-border p-2.5 flex-shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold hover:bg-accent transition-colors">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48 text-xs shadow-lg">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs font-semibold text-foreground">{session.user?.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{session.user?.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 cursor-pointer">
                      <Settings className="h-3.5 w-3.5" />
                      Configuración
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="gap-2 cursor-pointer">
                      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="h-3.5 w-3.5" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors text-left group">
                    <div className="w-7 h-7 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {session.user?.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {session.user?.email}
                      </p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-52 mb-1.5 text-xs shadow-lg">
                  <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" />
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="gap-2 cursor-pointer">
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="h-3.5 w-3.5" />
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
            "transition-all duration-200 min-h-screen",
            "ml-0 pt-14 md:pt-0",
            collapsed ? "md:ml-[60px]" : "md:ml-60"
          )}
        >
          <div className="p-4 md:p-8 pb-12 max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
