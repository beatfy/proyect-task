"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Home, FolderOpen, CheckSquare, Calendar, Settings, LogOut, ChevronLeft, ChevronRight, Mail, Sun, Moon, Building2, FileText, MessageCircle, Menu, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ChatSidebar from "@/components/chat/ChatSidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sections = [
  {
    label: "General",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Home },
      { name: "Organizaciones", href: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { name: "Proyectos", href: "/projects", icon: FolderOpen },
      { name: "Tareas", href: "/tasks", icon: CheckSquare },
      { name: "Calendario", href: "/calendar", icon: Calendar },
      { name: "Archivos", href: "/files", icon: FileText },
      { name: "Mail", href: "/mail", icon: Mail },
    ],
  },
  {
    label: "Negocio",
    items: [
      { name: "Facturación", href: "/billing", icon: Receipt },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Configuración", href: "/settings", icon: Settings },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          <Link href="/dashboard" className="text-lg font-bold text-neutral-900">TaskX</Link>
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
              <Link href="/dashboard" className="text-xl font-bold text-neutral-900 dark:text-neutral-500">
                TaskX
              </Link>
            )}
            {collapsed && (
              <Link href="/dashboard" className="text-lg font-bold text-neutral-900 dark:text-neutral-500">
                T
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
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const linkContent = (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        isActive
                          ? "bg-neutral-900 text-white dark:bg-neutral-900 dark:text-white"
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

          {/* Theme toggle */}
          <div className="px-2 pb-2 flex-shrink-0">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-full text-muted-foreground hover:text-accent-foreground"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-accent-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {theme === "dark" ? "Tema claro" : "Tema oscuro"}
              </Button>
            )}
          </div>

          {/* User section */}
          <div className="border-t border-border p-2 flex-shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-medium cursor-default">
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {session.user?.name}<br />{session.user?.email}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-accent-foreground"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Cerrar sesión</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-medium">
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
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </Button>
              </div>
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

        {/* Tasky Chat Button */}
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-neutral-900 hover:bg-neutral-800 active:bg-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          title="Chat con Tasky"
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Tasky Chat Sidebar */}
        <ChatSidebar
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}
