"use client";

import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Proyecto {id}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Tareas del Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Selecciona un proyecto para ver sus tareas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}