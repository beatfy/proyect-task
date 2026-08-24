"use client";

import { useState, useEffect, use } from "react";
import { MindMapEditor } from "@/components/mindmap/MindMapEditor";
import { MindMapRecord } from "@/lib/types/mindmap";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function MindMapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [map, setMap] = useState<MindMapRecord | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [mapRes, projectsRes] = await Promise.all([
          fetch(`/api/mindmaps/${resolvedParams.id}`),
          fetch("/api/projects"),
        ]);

        if (!mapRes.ok) {
          if (mapRes.status === 404) {
            setError("Mapa mental no encontrado");
          } else {
            setError("Error al cargar el mapa mental");
          }
          return;
        }

        const mapData = await mapRes.json();
        setMap(mapData);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData);
        }
      } catch (err) {
        console.error(err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <Sparkles className="h-4 w-4 text-indigo-400 absolute" />
        </div>
      </div>
    );
  }

  if (error || !map) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <h2 className="text-xl font-bold text-white">{error || "No se pudo cargar el mapa"}</h2>
        <Link href="/mindmaps">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver a la galería de mapas
          </Button>
        </Link>
      </div>
    );
  }

  return <MindMapEditor initialMap={map} projects={projects} />;
}
