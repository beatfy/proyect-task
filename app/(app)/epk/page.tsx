"use client";

import { useState, useEffect } from "react";
import {
  Music, Plus, Trash2, Link, Loader2, Copy, Eye,
  ExternalLink, Pencil, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { brand } from "@/lib/branding";

interface EPKView {
  id: string;
  visitorIp: string | null;
  referrer: string | null;
  createdAt: string;
}

interface EPK {
  id: string;
  slug: string;
  artistName: string;
  bio: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  soundcloudUrl: string | null;
  spotifyUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  tracks: { title: string; url: string }[] | null;
  highlights: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  views: EPKView[];
  _count: { views: number };
}

interface FormData {
  artistName: string;
  bio: string;
  photoUrl: string;
  coverUrl: string;
  soundcloudUrl: string;
  spotifyUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  tracksJson: string;
  highlightsJson: string;
}

const emptyForm: FormData = {
  artistName: "",
  bio: "",
  photoUrl: "",
  coverUrl: "",
  soundcloudUrl: "",
  spotifyUrl: "",
  instagramUrl: "",
  websiteUrl: "",
  tracksJson: '[{"title":"","url":""}]',
  highlightsJson: "[]",
};

function toForm(epk: EPK): FormData {
  const tracks = Array.isArray(epk.tracks) ? epk.tracks : [];
  return {
    artistName: epk.artistName,
    bio: epk.bio || "",
    photoUrl: epk.photoUrl || "",
    coverUrl: epk.coverUrl || "",
    soundcloudUrl: epk.soundcloudUrl || "",
    spotifyUrl: epk.spotifyUrl || "",
    instagramUrl: epk.instagramUrl || "",
    websiteUrl: epk.websiteUrl || "",
    tracksJson: JSON.stringify(tracks.length ? tracks : [{ title: "", url: "" }]),
    highlightsJson: JSON.stringify(epk.highlights || []),
  };
}

function parseTracks(raw: string): { title: string; url: string }[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t: { title?: string; url?: string }) => t.title || t.url);
  } catch {
    return [];
  }
}

function parseHighlights(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h: string) => typeof h === "string" && h.trim());
  } catch {
    return [];
  }
}

export default function EPKPage() {
  const [epks, setEpks] = useState<EPK[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [selectedEpk, setSelectedEpk] = useState<EPK | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => {
    fetchEpks();
  }, []);

  const fetchEpks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/epk");
      if (res.ok) setEpks(await res.json());
    } catch {
      toast.error("Error al cargar EPKs");
    } finally {
      setLoading(false);
    }
  };

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTrackField = () => {
    const tracks = parseTracks(form.tracksJson);
    tracks.push({ title: "", url: "" });
    setField("tracksJson", JSON.stringify(tracks));
  };

  const updateTrack = (index: number, field: "title" | "url", value: string) => {
    const tracks = parseTracks(form.tracksJson);
    if (index < tracks.length) {
      tracks[index] = { ...tracks[index], [field]: value };
    }
    setField("tracksJson", JSON.stringify(tracks));
  };

  const removeTrack = (index: number) => {
    const tracks = parseTracks(form.tracksJson);
    tracks.splice(index, 1);
    setField("tracksJson", JSON.stringify(tracks.length ? tracks : [{ title: "", url: "" }]));
  };

  const addHighlightField = () => {
    const highlights = parseHighlights(form.highlightsJson);
    highlights.push("");
    setField("highlightsJson", JSON.stringify(highlights));
  };

  const updateHighlight = (index: number, value: string) => {
    const highlights = parseHighlights(form.highlightsJson);
    if (index < highlights.length) highlights[index] = value;
    setField("highlightsJson", JSON.stringify(highlights));
  };

  const removeHighlight = (index: number) => {
    const highlights = parseHighlights(form.highlightsJson);
    highlights.splice(index, 1);
    setField("highlightsJson", JSON.stringify(highlights));
  };

  const handleCreate = async () => {
    if (!form.artistName.trim()) {
      toast.error("El nombre del artista es requerido");
      return;
    }
    setSaving(true);
    try {
      const tracks = parseTracks(form.tracksJson);
      const highlights = parseHighlights(form.highlightsJson);
      const res = await fetch("/api/epk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: form.artistName,
          bio: form.bio || null,
          photoUrl: form.photoUrl || null,
          coverUrl: form.coverUrl || null,
          soundcloudUrl: form.soundcloudUrl || null,
          spotifyUrl: form.spotifyUrl || null,
          instagramUrl: form.instagramUrl || null,
          websiteUrl: form.websiteUrl || null,
          tracks: tracks.length ? tracks : null,
          highlights: highlights.length ? highlights : null,
        }),
      });
      if (res.ok) {
        toast.success("EPK creado correctamente");
        setCreateOpen(false);
        setForm(emptyForm);
        fetchEpks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear EPK");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEpk || !form.artistName.trim()) {
      toast.error("El nombre del artista es requerido");
      return;
    }
    setSaving(true);
    try {
      const tracks = parseTracks(form.tracksJson);
      const highlights = parseHighlights(form.highlightsJson);
      const res = await fetch("/api/epk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedEpk.id,
          artistName: form.artistName,
          bio: form.bio || null,
          photoUrl: form.photoUrl || null,
          coverUrl: form.coverUrl || null,
          soundcloudUrl: form.soundcloudUrl || null,
          spotifyUrl: form.spotifyUrl || null,
          instagramUrl: form.instagramUrl || null,
          websiteUrl: form.websiteUrl || null,
          tracks: tracks.length ? tracks : null,
          highlights: highlights.length ? highlights : null,
        }),
      });
      if (res.ok) {
        toast.success("EPK actualizado");
        setEditOpen(false);
        setSelectedEpk(null);
        setForm(emptyForm);
        fetchEpks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este EPK? Esta acción no se puede deshacer.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/epk?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEpks((prev) => prev.filter((e) => e.id !== id));
        toast.success("EPK eliminado");
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (epk: EPK) => {
    try {
      const res = await fetch("/api/epk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: epk.id, isActive: !epk.isActive }),
      });
      if (res.ok) {
        fetchEpks();
        toast.success(epk.isActive ? "EPK desactivado" : "EPK activado");
      }
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${brand.appUrl}/epk/${slug}`);
    toast.success("Enlace copiado al portapapeles");
  };

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (epk: EPK) => {
    setSelectedEpk(epk);
    setForm(toForm(epk));
    setEditOpen(true);
  };

  const openViews = (epk: EPK) => {
    setSelectedEpk(epk);
    setViewsOpen(true);
  };

  const statusBadge = (epk: EPK) => {
    if (!epk.isActive) {
      return (
        <Badge className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Inactivo
        </Badge>
      );
    }
    return (
      <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Activo
      </Badge>
    );
  };

  const currentTracks = parseTracks(form.tracksJson);
  const currentHighlights = parseHighlights(form.highlightsJson);

  const renderFormFields = () => (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div>
        <Label className="text-foreground">Nombre del artista *</Label>
        <Input
          value={form.artistName}
          onChange={(e) => setField("artistName", e.target.value)}
          placeholder="Ej: DJ Martínez"
          className="bg-background border-border text-foreground"
        />
      </div>
      <div>
        <Label className="text-foreground">Bio</Label>
        <Textarea
          value={form.bio}
          onChange={(e) => setField("bio", e.target.value)}
          placeholder="Biografía del artista..."
          rows={3}
          className="bg-background border-border text-foreground resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">Foto (URL)</Label>
          <Input
            value={form.photoUrl}
            onChange={(e) => setField("photoUrl", e.target.value)}
            placeholder="https://..."
            className="bg-background border-border text-foreground"
          />
        </div>
        <div>
          <Label className="text-foreground">Cover (URL)</Label>
          <Input
            value={form.coverUrl}
            onChange={(e) => setField("coverUrl", e.target.value)}
            placeholder="https://..."
            className="bg-background border-border text-foreground"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">SoundCloud</Label>
          <Input
            value={form.soundcloudUrl}
            onChange={(e) => setField("soundcloudUrl", e.target.value)}
            placeholder="https://soundcloud.com/..."
            className="bg-background border-border text-foreground"
          />
        </div>
        <div>
          <Label className="text-foreground">Spotify</Label>
          <Input
            value={form.spotifyUrl}
            onChange={(e) => setField("spotifyUrl", e.target.value)}
            placeholder="https://open.spotify.com/..."
            className="bg-background border-border text-foreground"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground">Instagram</Label>
          <Input
            value={form.instagramUrl}
            onChange={(e) => setField("instagramUrl", e.target.value)}
            placeholder="https://instagram.com/..."
            className="bg-background border-border text-foreground"
          />
        </div>
        <div>
          <Label className="text-foreground">Website</Label>
          <Input
            value={form.websiteUrl}
            onChange={(e) => setField("websiteUrl", e.target.value)}
            placeholder="https://..."
            className="bg-background border-border text-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Tracks</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addTrackField}>
            <Plus className="h-3 w-3 mr-1" /> Añadir track
          </Button>
        </div>
        {currentTracks.map((track, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={track.title}
              onChange={(e) => updateTrack(i, "title", e.target.value)}
              placeholder="Título"
              className="bg-background border-border text-foreground flex-1"
            />
            <Input
              value={track.url}
              onChange={(e) => updateTrack(i, "url", e.target.value)}
              placeholder="URL"
              className="bg-background border-border text-foreground flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-red-500 hover:text-red-600 flex-shrink-0"
              onClick={() => removeTrack(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Highlights</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addHighlightField}>
            <Plus className="h-3 w-3 mr-1" /> Añadir highlight
          </Button>
        </div>
        {currentHighlights.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={h}
              onChange={(e) => updateHighlight(i, e.target.value)}
              placeholder="Ej: 1M streams en Spotify"
              className="bg-background border-border text-foreground flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-red-500 hover:text-red-600 flex-shrink-0"
              onClick={() => removeHighlight(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
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
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Music className="h-6 w-6 text-neutral-900" />
            Electronic Press Kit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona tus EPKs y comparte tu perfil profesional
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo EPK
        </Button>
      </div>

      {epks.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm mb-1">No hay EPKs creados</p>
            <p className="text-muted-foreground text-xs mb-4">
              Crea tu primer Electronic Press Kit para promocionar tu arte
            </p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Crear primer EPK
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {epks.map((epk) => {
            const publicUrl = `${brand.appUrl}/epk/${epk.slug}`;
            const isExpanded = expandedId === epk.id;
            const recentViews = epk.views
              ? [...epk.views].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
              : [];

            return (
              <Card
                key={epk.id}
                className="bg-card border-border hover:border-neutral-400 dark:hover:border-neutral-800 transition-colors group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {epk.photoUrl ? (
                        <img
                          src={epk.photoUrl}
                          alt={epk.artistName}
                          className="h-10 w-10 rounded-full object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Music className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-base text-foreground line-clamp-1">
                          {epk.artistName}
                        </CardTitle>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          /{epk.slug}
                        </p>
                      </div>
                    </div>
                    {statusBadge(epk)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {epk.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{epk.bio}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{epk._count.views} visita{epk._count.views !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{Array.isArray(epk.tracks) ? epk.tracks.length : 0} tracks</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
                    <Link className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                      {publicUrl}
                    </span>
                    <button onClick={() => copyLink(epk.slug)} className="flex-shrink-0 hover:text-foreground transition-colors cursor-pointer">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => openEdit(epk)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => openViews(epk)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Visitas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(epk.id)}
                      disabled={deleting === epk.id}
                    >
                      {deleting === epk.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={epk.isActive}
                        onCheckedChange={() => toggleActive(epk)}
                        className="scale-75"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {epk.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      Ver público <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nuevo EPK</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear EPK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setSelectedEpk(null); setForm(emptyForm); } }}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar EPK — {selectedEpk?.artistName}</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewsOpen} onOpenChange={setViewsOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Visitas — {selectedEpk?.artistName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{selectedEpk?._count.views} visita{selectedEpk && selectedEpk._count.views !== 1 ? "s" : ""} en total</span>
            </div>
            {selectedEpk && selectedEpk.views && selectedEpk.views.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {[...selectedEpk.views]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 20)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {v.referrer || v.visitorIp || "Visitante anónimo"}
                        </span>
                      </div>
                      <span className="text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
                        {new Date(v.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <Card className="bg-background border-border border-dashed">
                <CardContent className="py-8 text-center">
                  <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-muted-foreground text-sm">
                    Aún no hay visitas registradas
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setViewsOpen(false)} className="border-border">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
