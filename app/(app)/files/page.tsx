"use client";

import { useState, useEffect, useRef } from "react";
import { File, Image, Trash2, Download, Search, Loader2, Music, Play, Pause, Share2, Lock, Clock, Headphones, Link as LinkIcon, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/branding";

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt: string;
  task: { id: string; title: string };
}

interface AudioShare {
  id: string;
  title: string;
  slug: string;
  fileUrl: string;
  fileName: string;
  artistName: string | null;
  expiresAt: string | null;
  maxPlays: number | null;
  playCount: number;
  isActive: boolean;
  createdAt: string;
  _count: { plays: number };
}

type FilterType = "all" | "image" | "document" | "audio";

const typeColors: Record<string, string> = {
  image: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  pdf: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  document: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  audio: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};

const typeLabels: Record<string, string> = {
  image: "Imagen",
  pdf: "PDF",
  document: "Documento",
  audio: "Audio",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAudioFile(name: string, type: string): boolean {
  const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma"];
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  return type === "audio" || audioExts.includes(ext);
}

function AudioPlayer({ url, name }: { url: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 space-y-2">
      <audio ref={audioRef} src={url} preload="metadata" />
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-purple-600 transition-colors">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="w-full bg-purple-200 dark:bg-purple-800/50 rounded-full h-1.5 cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration) audioRef.current.currentTime = pct * duration;
          }}>
            <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-purple-600 dark:text-purple-400">{formatTime(progress)}</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FilesPage() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [shares, setShares] = useState<AudioShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareFile, setShareFile] = useState<Attachment | null>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareArtist, setShareArtist] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [shareMaxPlays, setShareMaxPlays] = useState("");
  const [creatingShare, setCreatingShare] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
    fetchShares();
  }, [filter]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (filter !== "all") params.set("type", filter);
      const res = await fetch(`/api/attachments?${params}`);
      if (res.ok) setFiles(await res.json());
    } catch { toast.error("Error al cargar archivos"); }
    finally { setLoading(false); }
  };

  const fetchShares = async () => {
    try {
      const res = await fetch("/api/audio-vault");
      if (res.ok) setShares(await res.json());
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      if (res.ok) { setFiles(files.filter(f => f.id !== id)); toast.success("Archivo eliminado"); }
      else { toast.error("Error al eliminar"); }
    } catch { toast.error("Error de conexión"); }
    finally { setDeleting(null); }
  };

  const handleDeleteShare = async (id: string) => {
    try {
      const res = await fetch(`/api/audio-vault?id=${id}`, { method: "DELETE" });
      if (res.ok) { setShares(shares.filter(s => s.id !== id)); toast.success("Link eliminado"); }
    } catch { toast.error("Error al eliminar"); }
  };

  const openShareDialog = (file: Attachment) => {
    setShareFile(file);
    setShareTitle(file.name.replace(/\.[^/.]+$/, ""));
    setShareArtist("");
    setShareExpires("");
    setShareMaxPlays("");
    setShareDialogOpen(true);
  };

  const handleCreateShare = async () => {
    if (!shareFile || !shareTitle) return;
    setCreatingShare(true);
    try {
      const res = await fetch("/api/audio-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: shareTitle,
          artistName: shareArtist || undefined,
          fileUrl: shareFile.url,
          fileName: shareFile.name,
          expiresAt: shareExpires || undefined,
          maxPlays: shareMaxPlays ? parseInt(shareMaxPlays) : undefined,
        }),
      });
      if (res.ok) {
        const newShare = await res.json();
        setShares([newShare, ...shares]);
        setShareDialogOpen(false);
        toast.success("Link privado generado");
      } else {
        toast.error("Error al generar link");
      }
    } catch { toast.error("Error de conexión"); }
    finally { setCreatingShare(false); }
  };

  const copyLink = (slug: string) => {
    const url = `${brand.appUrl}/audio/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.task.title.toLowerCase().includes(search.toLowerCase())
  );

  const audioFiles = filtered.filter(f => isAudioFile(f.name, f.type));
  const otherFiles = filtered.filter(f => !isAudioFile(f.name, f.type));
  const showFiles = filter === "audio" ? audioFiles : filter === "all" ? filtered : otherFiles;

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
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Music className="h-6 w-6 text-purple-500" />
            Audio Vault
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Tus demos, tracks y archivos. Genera links privados para A&Rs.</p>
        </div>
      </div>

      {/* Shared Audio Links */}
      {shares.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Lock className="h-4 w-4" /> Links Privados Activos
          </h2>
          <div className="space-y-2">
            {shares.map((share) => (
              <Card key={share.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <Headphones className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{share.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Headphones className="h-3 w-3" />{share.playCount} plays</span>
                          {share.expiresAt && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Exp: {new Date(share.expiresAt).toLocaleDateString("es-ES")}</span>
                          )}
                          {share.maxPlays && <span>Max: {share.maxPlays}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => copyLink(share.slug)}>
                        {copiedSlug === share.slug ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copiar Link
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-red-500" onClick={() => handleDeleteShare(share.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar archivos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border text-foreground" />
        </div>
        <div className="flex items-center bg-card rounded-lg p-1 border border-border">
          {([["all", "Todos"], ["audio", "Audio"], ["image", "Imágenes"], ["document", "Docs"]] as const).map(([val, label]) => (
            <Button key={val} variant={filter === val ? "default" : "ghost"} size="sm" onClick={() => setFilter(val as FilterType)} className="h-8 px-3">
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Files grid */}
      {showFiles.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            {files.length === 0 ? "No tienes archivos todavía" : "No hay resultados para la búsqueda"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {showFiles.map((file) => {
            const isAudio = isAudioFile(file.name, file.type);
            return (
              <Card key={file.id} className="bg-card border-border hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {isAudio ? (
                    <div className="space-y-2">
                      <div className="aspect-video rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/10 flex items-center justify-center">
                        <Music className="h-12 w-12 text-purple-400" />
                      </div>
                      <AudioPlayer url={file.url} name={file.name} />
                    </div>
                  ) : file.type === "image" ? (
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      <img src={`/api/attachments/${file.id}`} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                      <File className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-muted-foreground truncate">📋 {file.task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("text-[10px] border", typeColors[isAudio ? "audio" : file.type] || typeColors.document)}>
                        {typeLabels[isAudio ? "audio" : file.type] || "Archivo"}
                      </Badge>
                      {file.size && <span className="text-[10px] text-muted-foreground">{formatSize(file.size)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => window.open(file.url, '_blank')}>
                      <Download className="h-3 w-3 mr-1" /> Descargar
                    </Button>
                    {isAudio && (
                      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => openShareDialog(file)} title="Generar link privado">
                        <Lock className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(file.id)} disabled={deleting === file.id}>
                      {deleting === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-red-500" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-500" /> Generar Link Privado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-foreground">Título del track *</Label>
              <Input value={shareTitle} onChange={(e) => setShareTitle(e.target.value)} placeholder="Nombre del demo" className="bg-background border-border" />
            </div>
            <div>
              <Label className="text-foreground">Nombre del artista</Label>
              <Input value={shareArtist} onChange={(e) => setShareArtist(e.target.value)} placeholder="Tu nombre artístico" className="bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Expiración</Label>
                <Input type="date" value={shareExpires} onChange={(e) => setShareExpires(e.target.value)} className="bg-background border-border" />
              </div>
              <div>
                <Label className="text-foreground">Max reproducciones</Label>
                <Input type="number" value={shareMaxPlays} onChange={(e) => setShareMaxPlays(e.target.value)} placeholder="Sin límite" className="bg-background border-border" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">El A&R recibirá un link privado. Cada vez que escuche el track, recibirás una notificación.</p>
            <Button onClick={handleCreateShare} disabled={creatingShare || !shareTitle} className="w-full">
              {creatingShare && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generar Link Privado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
