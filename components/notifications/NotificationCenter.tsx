"use client";

import { useState, useEffect } from "react";
import { Bell, Check, Trash2, X, UserPlus, ClipboardList, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  read: boolean;
  createdAt: string;
  data: { projectId?: string; taskId?: string; invitationId?: string } | null;
}

interface Props {
  compact?: boolean; // Solo muestra el icono con badge
}

const typeIcons: Record<string, typeof Bell> = {
  PROJECT_INVITATION: UserPlus,
  TASK_ASSIGNED: ClipboardList,
  TASK_STATUS_CHANGED: CheckCircle2,
  COMMENT_MENTION: MessageCircle,
  PROJECT_JOINED: UserPlus,
};

const typeLabels: Record<string, string> = {
  PROJECT_INVITATION: "Invitación",
  TASK_ASSIGNED: "Tarea asignada",
  TASK_STATUS_CHANGED: "Estado cambiado",
  COMMENT_MENTION: "Mención",
  PROJECT_JOINED: "Nuevo miembro",
};

export default function NotificationCenter({ compact = false }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Update unread count if needed
      const deleted = notifications.find((n) => n.id === id);
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  const getLink = (notification: Notification) => {
    if (notification.type === "PROJECT_INVITATION") {
      return "/invitations";
    }
    if (notification.data?.projectId) {
      return `/projects/${notification.data.projectId}`;
    }
    return null;
  };

  if (compact) {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notificaciones</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Marcar todas leídas
                </Button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No hay notificaciones
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const link = getLink(notification);

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-3 border-b border-slate-100 dark:border-gray-700 last:border-0",
                        !notification.read && "bg-indigo-50 dark:bg-indigo-900/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 text-indigo-500 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {link ? (
                            <Link
                              href={link}
                              onClick={() => {
                                markAsRead(notification.id);
                                setOpen(false);
                              }}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600"
                            >
                              {notification.title}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {notification.title}
                            </p>
                          )}
                          {notification.content && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {notification.content}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block p-2 text-center text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              Ver todas
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Full page view
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Notificaciones</h1>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} disabled={loading}>
              <Check className="h-4 w-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Bell;
              const link = getLink(notification);

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 flex items-start gap-3",
                    !notification.read && "bg-indigo-50"
                  )}
                >
                  <Icon className="h-5 w-5 text-indigo-500" />
                  <div className="flex-1">
                    {link ? (
                      <Link
                        href={link}
                        onClick={() => markAsRead(notification.id)}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{notification.title}</p>
                    )}
                    {notification.content && (
                      <p className="text-sm text-gray-500 mt-1">
                        {notification.content}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {typeLabels[notification.type]} • {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!notification.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}