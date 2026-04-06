"use client";

import { useState, useEffect } from "react";
import { File, Image, Trash2, Download, Search, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt: string;
  task: { id: string; title: string };
}

type FilterType = "all" | "image" | "document";

const typeColors: Record<string, string> = {
  image: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  pdf: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  document: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
};

const typeLabels: Record<string, string> = {
  image: "Imagen",
  pdf: "PDF",
  document: "Documento",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [filter]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (filter !== "all") params.set("type", filter);
      const res = await fetch(`/api/attachments?${params}`);
      if (res.ok) setFiles(await res.json());
    } catch {
      toast.error("Error al cargar archivos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles(files.filter(f => f.id !== id));
        toast.success("Archivo eliminado");
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.task.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Archivos</h1>
          <p className="text-muted-foreground text-sm mt-1">Todos tus archivos de todas las tareas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar archivos o tareas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border text-foreground"
          />
        </div>
        <div className="flex items-center bg-card rounded-lg p-1 border border-border">
          {([["all", "Todos"], ["image", "Imágenes"], ["document", "Documentos"]] as const).map(([val, label]) => (
            <Button
              key={val}
              variant={filter === val ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(val as FilterType)}
              className="h-8 px-3"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Files grid */}
      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            {files.length === 0 ? "No tienes archivos todavía" : "No hay resultados para la búsqueda"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((file) => (
            <Card key={file.id} className="bg-card border-border hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                {/* Preview */}
                {file.type === "image" ? (
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={`/api/attachments/${file.id}`}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <File className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={file.task.title}>
                    📋 {file.task.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn("text-[10px] border", typeColors[file.type] || typeColors.document)}>
                      {typeLabels[file.type] || "Archivo"}
                    </Badge>
                    {file.size && (
                      <span className="text-[10px] text-muted-foreground">{formatSize(file.size)}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => window.open(`/api/attachments/${file.id}`, '_blank')}>
                    <Download className="h-3 w-3 mr-1" /> Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleDelete(file.id)}
                    disabled={deleting === file.id}
                  >
                    {deleting === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-red-500" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
