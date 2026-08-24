"use client";

import { useState, useEffect } from "react";
import { MindMapList } from "@/components/mindmap/MindMapList";
import { MindMapRecord } from "@/lib/types/mindmap";
import { Sparkles } from "lucide-react";

export default function MindMapsPage() {
  const [maps, setMaps] = useState<MindMapRecord[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [mapsRes, projectsRes] = await Promise.all([
          fetch("/api/mindmaps"),
          fetch("/api/projects"),
        ]);

        if (mapsRes.ok) {
          const mapsData = await mapsRes.json();
          setMaps(mapsData);
        }

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData);
        }
      } catch (error) {
        console.error("Error fetching mind maps:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <Sparkles className="h-4 w-4 text-indigo-400 absolute" />
        </div>
      </div>
    );
  }

  return <MindMapList initialMaps={maps} projects={projects} />;
}
