"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ArrowLeft, Phone, Mail, Building2, Calendar, Plus, Trash2,
  Edit2, Check, X, Clock, User, DollarSign, Tag, MessageSquare,
} from "lucide-react";

// --- Types ---
interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
  status: string;
  pipeline: { id: string; name: string } | null;
  deals: Deal[];
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedClose: string | null;
  notes: string | null;
  stage: { id: string; name: string; color: string; position: number };
  _count: { activities: number };
  movedAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  _count: { deals: number };
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  deal: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---
const statusLabels: Record<string, string> = {
  LEAD: "Lead",
  CONTACTED: "Contactado",
  QUALIFIED: "Cualificado",
  CUSTOMER: "Cliente",
};

const statusColors: Record<string, string> = {
  LEAD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CONTACTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  QUALIFIED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CUSTOMER: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

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
  dealId: "",
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
export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [saving, setSaving] = useState(false);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stageLoading, setStageLoading] = useState(false);

  const fetchContact = useCallback(async () => {
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`);
      if (response.ok) {
        setContact(await response.json());
      } else {
        router.push("/crm/contacts");
      }
    } catch (error) {
      console.error("Error loading contact:", error);
      router.push("/crm/contacts");
    } finally {
      setLoading(false);
    }
  }, [contactId, router]);

  useEffect(() => {
    fetchContact();
    fetch("/api/crm/pipelines")
      .then((res) => res.ok ? res.json() : [])
      .then(setPipelines)
      .catch(() => {});
  }, [fetchContact]);

  const handleQuickAction = (type: string) => {
    const defaults: Record<string, { title: string }> = {
      CALL: { title: `Llamada con ${contact?.name || ""}` },
      EMAIL: { title: `Email a ${contact?.name || ""}` },
      NOTE: { title: "Nueva nota" },
      MEETING: { title: `Reunión con ${contact?.name || ""}` },
    };
    setActivityForm({
      ...emptyActivityForm,
      type: type as "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE",
      title: defaults[type]?.title || "",
    });
    setActivityDialogOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!activityForm.title.trim()) return;
    setSaving(true);

    try {
      const payload = {
        type: activityForm.type,
        title: activityForm.title.trim(),
        description: activityForm.description.trim() || undefined,
        dueDate: activityForm.dueDate || undefined,
        contactId,
        dealId: activityForm.dealId || undefined,
      };

      await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setActivityDialogOpen(false);
      setActivityForm(emptyActivityForm);
      fetchContact();
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
      fetchContact();
    } catch (error) {
      console.error("Error toggling activity:", error);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await fetch(`/api/crm/activities?id=${id}`, { method: "DELETE" });
      setDeleteActivityId(null);
      fetchContact();
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (!stageId || !contact) return;
    setStageLoading(true);
    try {
      const existingDeal = contact.deals.length > 0 ? contact.deals[0] : null;
      if (existingDeal) {
        await fetch("/api/crm/deals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existingDeal.id, stageId }),
        });
      } else {
        const stage = pipelines
          .flatMap((p) => p.stages)
          .find((s) => s.id === stageId);
        const pipelineId = stage
          ? pipelines.find((p) => p.stages.some((s) => s.id === stageId))?.id
          : pipelines[0]?.id;
        if (!pipelineId) return;
        await fetch("/api/crm/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Deal - ${contact.name}`,
            contactId,
            stageId,
            pipelineId,
          }),
        });
      }
      fetchContact();
    } catch (error) {
      console.error("Error updating stage:", error);
    } finally {
      setStageLoading(false);
    }
  };

  const currentDeal = contact?.deals?.[0] ?? null;
  const allStages = pipelines.flatMap((p) => p.stages).sort((a, b) => a.position - b.position);
  const currentStageId = currentDeal?.stage?.id ?? "";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) return null;

  const totalDealValue = contact.deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/crm/contacts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
              {contact.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contact.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap text-sm text-muted-foreground">
                {contact.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{contact.email}</span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{contact.phone}</span>
                )}
                {contact.company && (
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{contact.company}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Badge className={statusColors[contact.status]}>{statusLabels[contact.status]}</Badge>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground mr-1">Acciones rápidas:</span>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("CALL")}>
              <Phone className="h-4 w-4 mr-1.5" /> Llamar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("EMAIL")}>
              <Mail className="h-4 w-4 mr-1.5" /> Enviar email
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("NOTE")}>
              <MessageSquare className="h-4 w-4 mr-1.5" /> Añadir nota
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("MEETING")}>
              <Calendar className="h-4 w-4 mr-1.5" /> Programar reunión
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="deals">Deals ({contact.deals.length})</TabsTrigger>
          <TabsTrigger value="activities">Actividades ({contact.activities.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Stage Selector */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {allStages.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Etapa del Pipeline</span>
                    </div>
                    <Select value={currentStageId} onValueChange={handleStageChange} disabled={stageLoading}>
                      <SelectTrigger className="w-full">
                        {stageLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Actualizando…
                          </span>
                        ) : currentDeal ? (
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentDeal.stage.color }} />
                            {currentDeal.stage.name}
                          </span>
                        ) : (
                          <SelectValue placeholder="Seleccionar etapa…" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {allStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                              {stage.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentDeal && (
                      <p className="text-xs text-muted-foreground">
                        Deal: <span className="text-foreground font-medium">{currentDeal.title}</span>
                        {currentDeal.value > 0 && (
                          <> · {formatCurrency(currentDeal.value)}</>
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay pipelines configurados</p>
                )}
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{contact.name}</span>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{contact.company}</span>
                  </div>
                )}
                <Separator />
                {contact.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {contact.notes && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Estadísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deals activos</span>
                  <span className="text-lg font-bold text-foreground">{contact.deals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor total pipeline</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(totalDealValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Actividades totales</span>
                  <span className="text-lg font-bold text-foreground">{contact.activities.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tareas pendientes</span>
                  <span className="text-lg font-bold text-foreground">
                    {contact.activities.filter(a => a.type === "TASK" && !a.completed).length}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge className={statusColors[contact.status]}>{statusLabels[contact.status]}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Creado</span>
                  <span className="text-sm text-foreground">
                    {new Date(contact.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Actividad reciente</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleQuickAction("NOTE")}>
                  <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
              </CardHeader>
              <CardContent>
                {contact.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin actividades</p>
                ) : (
                  <div className="space-y-3">
                    {contact.activities.slice(0, 8).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-2">
                        <span className="text-base mt-0.5">{activityIcons[activity.type] || "📌"}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${activity.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {activity.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          {contact.deals.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-foreground">Sin deals</h3>
                <p className="text-muted-foreground mt-1">Este contacto no tiene deals asociados</p>
                <Button className="mt-4" onClick={() => router.push("/crm/pipeline")}>
                  <Plus className="h-4 w-4 mr-2" /> Crear Deal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {contact.deals.length} deals · Valor total: <strong>{formatCurrency(totalDealValue)}</strong>
                </p>
              </div>
              {contact.deals.map((deal) => (
                <Card key={deal.id} className="bg-card border-border hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => router.push(`/crm/deals/${deal.id}`)}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-foreground">{deal.title}</h4>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: deal.stage.color, color: deal.stage.color }}
                          >
                            {deal.stage.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{formatCurrency(deal.value)}</span>
                          {deal.probability > 0 && <span>{deal.probability}% prob.</span>}
                          {deal.expectedClose && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(deal.expectedClose).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <span>{deal._count.activities} act.</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{contact.activities.length} actividades</p>
            <Button size="sm" onClick={() => {
              setActivityForm(emptyActivityForm);
              setActivityDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" /> Nueva actividad
            </Button>
          </div>

          {contact.activities.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-foreground">Sin actividades</h3>
                <p className="text-muted-foreground mt-1">Registra la primera interacción</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline */}
              <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />
              {contact.activities.map((activity, idx) => (
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
                          {activity.deal && (
                            <Badge variant="secondary" className="text-xs">{activity.deal.title}</Badge>
                          )}
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
                              Vence: {new Date(activity.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {activity.type === "TASK" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggleComplete(activity)}
                          >
                            <Check className={`h-4 w-4 ${activity.completed ? "text-green-500" : ""}`} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-500"
                          onClick={() => setDeleteActivityId(activity.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            {contact.deals.length > 0 && (
              <div>
                <Label htmlFor="activity-deal">Deal asociado (opcional)</Label>
                <Select value={activityForm.dealId} onValueChange={(v) => setActivityForm({ ...activityForm, dealId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {contact.deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              Crear
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
