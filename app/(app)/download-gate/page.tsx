"use client";

import { useState, useEffect } from "react";
import {
  Download, Plus, Trash2, Link, Mail, Loader2, Copy, Clock, ShieldCheck, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organization-context";
import { brand } from "@/lib/branding";

interface DownloadGate {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  expiresAt: string | null;
  maxDownloads: number | null;
  createdAt: string;
  _count: { downloads: number };
}

export default function DownloadGatePage() {
  const { selectedOrg } = useOrganization();
  const [gates, setGates] = useState<DownloadGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [selectedGate, setSelectedGate] = useState<DownloadGate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");

  useEffect(() => {
    if (selectedOrg) fetchGates();
  }, [selectedOrg]);

  const fetchGates = async () => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/download-gate?organizationId=${selectedOrg}`);
      if (res.ok) setGates(await res.json());
    } catch {
      toast.error("Error al cargar download gates");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFileUrl("");
    setFileName("");
    setExpiresAt("");
    setMaxDownloads("");
  };

  const handleCreate = async () => {
    if (!title.trim() || !fileUrl.trim() || !fileName.trim()) {
      toast.error("Título, URL del archivo y nombre del archivo son requeridos");
      return;
    }
    if (!selectedOrg) return;

    setSaving(true);
    try {
      const res = await fetch("/api/download-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          fileUrl,
          fileName,
          fileType: null,
          fileSize: null,
          organizationId: selectedOrg,
          expiresAt: expiresAt || null,
          maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
        }),
      });

      if (res.ok) {
        toast.success("Download gate creado");
        setCreateOpen(false);
        resetForm();
        fetchGates();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este download gate?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/download-gate?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGates(gates.filter((g) => g.id !== id));
        toast.success("Download gate eliminado");
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${brand.appUrl}/d/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado al portapapeles");
  };

  const getGateStatus = (gate: DownloadGate) => {
    const now = new Date();
    if (gate.expiresAt && new Date(gate.expiresAt) < now) return "expired";
    if (gate.maxDownloads && gate._count.downloads >= gate.maxDownloads) return "limit_reached";
    return "active";
  };

  const statusConfig: Record<string, { label: string; class: string }> = {
    active: {
      label: "Activo",
      class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    expired: {
      label: "Expirado",
      class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    limit_reached: {
      label: "Límite alcanzado",
      class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
  };

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
            <Download className="h-6 w-6 text-neutral-900" />
            Download Gates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Captura emails a cambio de descargas exclusivas
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Gate
        </Button>
      </div>

      {gates.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Download className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm mb-1">No hay download gates</p>
            <p className="text-muted-foreground text-xs mb-4">
              Crea un gate para compartir archivos a cambio de emails
            </p>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Crear primer gate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gates.map((gate) => {
            const status = getGateStatus(gate);
            const statusInfo = statusConfig[status];
            const publicUrl = `${brand.appUrl}/d/${gate.slug}`;

            return (
              <Card
                key={gate.id}
                className="bg-card border-border hover:border-neutral-400 dark:hover:border-neutral-800 transition-colors group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-foreground line-clamp-1">
                      {gate.title}
                    </CardTitle>
                    <Badge className={`text-[10px] whitespace-nowrap ${statusInfo.class}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gate.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{gate.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Download className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{gate._count.downloads} descarga{gate._count.downloads !== 1 ? "s" : ""}</span>
                    {gate.maxDownloads && (
                      <span className="text-muted-foreground/60">/ {gate.maxDownloads} max</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    <button
                      onClick={() => { setSelectedGate(gate); setEmailsOpen(true); }}
                      className="hover:text-foreground transition-colors underline-offset-2 hover:underline cursor-pointer"
                    >
                      {gate._count.downloads} email{gate._count.downloads !== 1 ? "s" : ""} capturado{gate._count.downloads !== 1 ? "s" : ""}
                    </button>
                  </div>

                  {gate.expiresAt && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        {status === "expired" ? "Expiró" : "Expira"} el{" "}
                        {new Date(gate.expiresAt).toLocaleDateString("es-ES", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2.5 py-1.5">
                    <Link className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                      {publicUrl}
                    </span>
                    <button onClick={() => copyLink(gate.slug)} className="flex-shrink-0 hover:text-foreground transition-colors cursor-pointer">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => { setSelectedGate(gate); setEmailsOpen(true); }}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1" /> Ver Emails
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(gate.id)}
                      disabled={deleting === gate.id}
                    >
                      {deleting === gate.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nuevo Download Gate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground">Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Single Nuevo - Descarga Exclusiva"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Descripción</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción breve para la página de descarga"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">URL del archivo *</Label>
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://ejemplo.com/archivo.mp3"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Nombre del archivo *</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="cancion.mp3"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Expiración</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground">Máx. descargas</Label>
                <Input
                  type="number"
                  min="1"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  placeholder="Sin límite"
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Gate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emails Dialog */}
      <Dialog open={emailsOpen} onOpenChange={setEmailsOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Emails capturados — {selectedGate?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>
                {selectedGate?._count.downloads} email{selectedGate && selectedGate._count.downloads !== 1 ? "s" : ""} capturado{selectedGate && selectedGate._count.downloads !== 1 ? "s" : ""}
              </span>
            </div>
            <Card className="bg-background border-border border-dashed">
              <CardContent className="py-8 text-center">
                <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-muted-foreground text-sm">
                  La lista detallada de emails estará disponible próximamente.
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Total: {selectedGate?._count.downloads ?? 0} registros
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setEmailsOpen(false)} className="border-border">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
