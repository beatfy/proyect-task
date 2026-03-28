"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Home, FolderOpen, CheckSquare, Calendar, Settings, LogOut, Plus, ChevronLeft, ChevronRight, Mail, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationCenter from "@/components/notifications/NotificationCenter";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Proyectos", href: "/projects", icon: FolderOpen },
  { name: "Tareas", href: "/tasks", icon: CheckSquare },
  { name: "Calendario", href: "/calendar", icon: Calendar },
  { name: "Invitaciones", href: "/invitations", icon: Mail },
  { name: "Notificaciones", href: "/notifications", icon: Bell },
  { name: "Configuración", href: "/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
            {!collapsed && (
              <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
                TaskX
              </Link>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <NotificationCenter compact />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-500 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-200">
            <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-medium">
                {session.user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {session.user?.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {session.user?.email}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-slate-600 hover:bg-slate-100"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "transition-all duration-300 min-h-screen",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-6 pb-8">{children}</div>
      </main>
    </div>
  );
}