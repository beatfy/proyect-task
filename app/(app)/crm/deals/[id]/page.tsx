"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ArrowLeft, Plus, Trash2, Check, Calendar, Clock, User,
  DollarSign, Edit2, MessageSquare, Phone, Mail, FileText, Download,
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedClose: string | null;
  notes: string | null;
  contact: { id: string; name: string; email: string; company: string };
  stage: { id: string; name: string; color: string; position: number };
  pipeline: { id: string; name: string };
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
  movedAt: string;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  contact: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface PipelineData {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string; position: number }[];
}

// --- Constants ---
const activityIcons: Record<string, string> = {
  CALL: "📞",
  EMAIL: "✉️",
  MEETING: "📅",
  TASK: "✅",
  NOTE: "📝",
};

const activityLabels: Record<string, string> = {
  CALL: "Llamada",
  EMAIL: "Email",
  MEETING: "Reunión",
  TASK: "Tarea",
  NOTE: "Nota",
};

const emptyActivityForm = {
  type: "NOTE" as string,
  title: "",
  description: "",
  dueDate: "",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// --- Component ---
export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [saving, setSaving] = useState(false);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contracts, setContracts] = useState<{ id: string; fileName: string; status: string; createdAt: string; pdfUrl: string }[]>([]);

  const fetchDeal = useCallback(async () => {
    try {
      const response = await fetch(`/api/crm/deals/${dealId}`);
      if (response.ok) {
        const data = await response.json();
        setDeal(data);
        // Also fetch pipeline for stage changing
        const pipelineRes = await fetch(`/api/crm/pipelines?pipelineId=${data.pipeline.id}`);
        if (pipelineRes.ok) {
          const pipelines = await pipelineRes.json();
          setPipeline(pipelines[0] || null);
        }
      } else {
        router.push("/crm/pipeline");
      }
    } catch (error) {
      console.error("Error loading deal:", error);
      router.push("/crm/pipeline");
    } finally {
      setLoading(false);
    }
  }, [dealId, router]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  useEffect(() => {
    fetch(`/api/crm/contracts?dealId=${dealId}`).then(r => r.ok ? r.json() : []).then(setContracts).catch(() => {});
  }, [dealId]);

  const handleGenerateContract = async () => {
    setGeneratingContract(true);
    try {
      const res = await fetch("/api/crm/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      if (res.ok) {
        const contract = await res.json();
        setContracts([contract, ...contracts]);
        toast.success("Contrato generado correctamente");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al generar contrato");
      }
    } catch {
      toast.error("Error al generar contrato");
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleStageChange = async (newStageId: string) => {
    if (!deal) return;
    try {
      await fetch("/api/crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, stageId: newStageId }),
      });
      fetchDeal();
    } catch (error) {
      console.error("Error changing stage:", error);
    }
  };

  const handleSaveActivity = async () => {
    if (!deal || !activityForm.title.trim()) return;
    setSaving(true);

    try {
      if (editingActivity) {
        await fetch("/api/crm/activities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingActivity.id,
            title: activityForm.title.trim(),
            description: activityForm.description.trim() || null,
            dueDate: activityForm.dueDate || null,
          }),
        });
      } else {
        await fetch("/api/crm/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: activityForm.type,
            title: activityForm.title.trim(),
            description: activityForm.description.trim() || undefined,
            dueDate: activityForm.dueDate || undefined,
            contactId: deal.contact.id,
            dealId: deal.id,
          }),
        });
      }

      setActivityDialogOpen(false);
      setEditingActivity(null);
      setActivityForm(emptyActivityForm);
      fetchDeal();
    } catch (error) {
      console.error("Error saving activity:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (activity: Activity) => {
    try {
      await fetch("/api/crm/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activity.id, completed: !activity.completed }),
      });
      fetchDeal();
    } catch (error) {
      console.error("Error toggling activity:", error);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await fetch(`/api/crm/activities?id=${id}`, { method: "DELETE" });
      setDeleteActivityId(null);
      fetchDeal();
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityForm({
      type: activity.type as "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE",
      title: activity.title,
      description: activity.description || "",
      dueDate: activity.dueDate ? activity.dueDate.split("T")[0] : "",
    });
    setActivityDialogOpen(true);
  };

  const openNewActivity = () => {
    setEditingActivity(null);
    setActivityForm(emptyActivityForm);
    setActivityDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deal) return null;

  const completedTasks = deal.activities.filter(a => a.type === "TASK" && a.completed).length;
  const pendingTasks = deal.activities.filter(a => a.type === "TASK" && !a.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/crm/pipeline")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{deal.contact.name}</span>
            {deal.contact.company && <span>{deal.contact.company}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleGenerateContract} disabled={generatingContract}>
            {generatingContract ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
            Generar Contrato
          </Button>
        </div>
      </div>
      {contracts.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Contratos Generados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.fileName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("es-ES")}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={c.pdfUrl} download={c.fileName}>
                      <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Details Card */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Detalles del Deal</CardTitle>
              <Button variant="outline" size="sm" onClick={() => router.push(`/crm/contacts/${deal.contact.id}`)}>
                <User className="h-4 w-4 mr-1.5" /> Ver contacto
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(deal.value)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor ponderado</Label>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(deal.value * deal.probability / 100)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Etapa actual</Label>
                  <div className="mt-1">
                    {pipeline ? (
                      <Select value={deal.stage.id} onValueChange={handleStageChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pipeline.stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" style={{ borderColor: deal.stage.color, color: deal.stage.color }}>
                        {deal.stage.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Probabilidad</Label>
                  <p className="text-lg font-semibold text-foreground">{deal.probability}%</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${deal.probability}%`, backgroundColor: deal.stage.color }}
                    />
                  </div>
                </div>
                {deal.expectedClose && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha cierre estimada</Label>
                    <p className="text-sm text-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(deal.expectedClose).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                )}
                {deal.notes && (
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activities */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Actividades ({deal.activities.length})</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completedTasks} completadas · {pendingTasks} pendientes
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                  setActivityForm({ ...emptyActivityForm, type: "NOTE", title: "Nueva nota" });
                  setEditingActivity(null);
                  setActivityDialogOpen(true);
                }}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Nota
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                  setActivityForm({ ...emptyActivityForm, type: "CALL", title: `Llamada: ${deal.title}` });
                  setEditingActivity(null);
                  setActivityDialogOpen(true);
                }}>
                  <Phone className="h-3 w-3 mr-1" /> Llamar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={openNewActivity}>
                  <Plus className="h-3 w-3 mr-1" /> Más
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deal.activities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Sin actividades en este deal</p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />
                  {deal.activities.map((activity) => (
                    <div key={activity.id} className="relative flex items-start gap-4 py-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 z-10 ${
                        activity.completed ? "bg-green-100 dark:bg-green-900/30" : "bg-card border border-border"
                      }`}>
                        {activity.completed ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> : activityIcons[activity.type] || "📌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${activity.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {activity.title}
                              </span>
                              <Badge variant="outline" className="text-xs">{activityLabels[activity.type]}</Badge>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{activity.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeAgo(activity.createdAt)}
                              {activity.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(activity.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditActivity(activity)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {activity.type === "TASK" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleComplete(activity)}>
                                <Check className={`h-4 w-4 ${activity.completed ? "text-green-500" : ""}`} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500"
                              onClick={() => setDeleteActivityId(activity.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                setActivityForm({ ...emptyActivityForm, type: "CALL", title: `Llamada: ${deal.title}` });
                setEditingActivity(null);
                setActivityDialogOpen(true);
              }}>
                <Phone className="h-4 w-4 mr-2" /> Registrar llamada
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                setActivityForm({ ...emptyActivityForm, type: "EMAIL", title: `Email: ${deal.title}` });
                setEditingActivity(null);
                setActivityDialogOpen(true);
              }}>
                <Mail className="h-4 w-4 mr-2" /> Registrar email
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                setActivityForm({ ...emptyActivityForm, type: "MEETING", title: `Reunión: ${deal.title}` });
                setEditingActivity(null);
                setActivityDialogOpen(true);
              }}>
                <Calendar className="h-4 w-4 mr-2" /> Programar reunión
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                setActivityForm({ ...emptyActivityForm, type: "NOTE", title: "Nota" });
                setEditingActivity(null);
                setActivityDialogOpen(true);
              }}>
                <MessageSquare className="h-4 w-4 mr-2" /> Añadir nota
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                setActivityForm({ ...emptyActivityForm, type: "TASK", title: "Nueva tarea" });
                setEditingActivity(null);
                setActivityDialogOpen(true);
              }}>
                <Check className="h-4 w-4 mr-2" /> Crear tarea
              </Button>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {deal.contact.name[0].toUpperCase()}
                  </div>
                  <div>
                    <Button variant="link" className="p-0 h-auto text-sm font-medium text-foreground"
                      onClick={() => router.push(`/crm/contacts/${deal.contact.id}`)}>
                      {deal.contact.name}
                    </Button>
                    {deal.contact.company && (
                      <p className="text-xs text-muted-foreground">{deal.contact.company}</p>
                    )}
                  </div>
                </div>
                {deal.contact.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${deal.contact.email}`} className="text-primary hover:underline">{deal.contact.email}</a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deal Summary */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pipeline</span>
                <span className="text-foreground">{deal.pipeline.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Etapa</span>
                <Badge variant="outline" style={{ borderColor: deal.stage.color, color: deal.stage.color }}>
                  {deal.stage.name}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Creado</span>
                <span className="text-foreground">
                  {new Date(deal.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Último movimiento</span>
                <span className="text-foreground">
                  {new Date(deal.movedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Editar Actividad" : "Nueva Actividad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingActivity && (
              <div>
                <Label htmlFor="activity-type">Tipo</Label>
                <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v as "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(activityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {activityIcons[key]} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="activity-title">Título *</Label>
              <Input
                id="activity-title"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                placeholder="Título de la actividad"
              />
            </div>
            <div>
              <Label htmlFor="activity-description">Descripción</Label>
              <textarea
                id="activity-description"
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Detalles..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div>
              <Label htmlFor="activity-due">Fecha límite (opcional)</Label>
              <Input
                id="activity-due"
                type="date"
                value={activityForm.dueDate}
                onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveActivity} disabled={saving || !activityForm.title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingActivity ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Confirm */}
      <Dialog open={!!deleteActivityId} onOpenChange={(open) => setDeleteActivityId(open ? deleteActivityId : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar actividad?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteActivityId && handleDeleteActivity(deleteActivityId)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
