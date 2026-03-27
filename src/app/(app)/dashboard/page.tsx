"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface TaskStats {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<TaskStats>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const tasks: Task[] = await response.json();
        
        const now = new Date();
        const pending = tasks.filter(t => t.status === "TODO").length;
        const inProgress = tasks.filter(t => t.status === "INPROGRESS").length;
        const completed = tasks.filter(t => t.status === "DONE").length;
        const overdue = tasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
        ).length;

        setStats({ pending, inProgress, completed, overdue });
        setRecentTasks(tasks.slice(0, 5));
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const statCards = [
    { name: "Tareas Pendientes", value: stats.pending, icon: CheckSquare, color: "text-blue-500" },
    { name: "En Progreso", value: stats.inProgress, icon: Clock, color: "text-yellow-500" },
    { name: "Completadas", value: stats.completed, icon: CheckCircle, color: "text-green-500" },
    { name: "Vencidas", value: stats.overdue, icon: AlertCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          ¡Hola, {session?.user?.name || "Usuario"}!
        </h1>
        <p className="text-gray-400 mt-1">
          Aquí tienes un resumen de tus tareas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent tasks */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Tareas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <p className="text-gray-300 text-center py-8">
              No hay tareas recientes. ¡Crea tu primera tarea!
            </p>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-800/50"
                >
                  <span className="font-medium text-white">{task.title}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    task.status === "DONE" 
                      ? "bg-green-500/20 text-green-400"
                      : task.status === "INPROGRESS"
                      ? "bg-blue-500/20 text-blue-400"
                      : task.status === "INREVIEW"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}>
                    {task.status === "DONE" ? "Hecho" : 
                     task.status === "INPROGRESS" ? "En progreso" :
                     task.status === "INREVIEW" ? "En revisión" : "Por hacer"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}