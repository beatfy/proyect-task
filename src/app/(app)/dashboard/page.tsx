"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { data: session } = useSession();

  const stats = [
    { name: "Tareas Pendientes", value: "12", icon: CheckSquare, color: "text-blue-600" },
    { name: "En Progreso", value: "5", icon: Clock, color: "text-yellow-600" },
    { name: "Completadas Hoy", value: "8", icon: CheckCircle, color: "text-green-600" },
    { name: "Vencidas", value: "2", icon: AlertCircle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          ¡Hola, {session?.user?.name || "Usuario"}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Aquí tienes un resumen de tus tareas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No hay tareas recientes. ¡Crea tu primera tarea!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}