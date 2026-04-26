"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, X, Trash2, DollarSign, Calendar, User, GripVertical,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useOrganization } from "@/lib/organization-context";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  pipelineId: string;
  _count: { deals: number };
  deals: Deal[];
}

interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedClose: string | null;
  notes: string | null;
  contact: { id: string; name: string; email: string; company: string };
  stage: { id: string; name: string; color: string; position: number };
  _count: { activities: number };
  movedAt: string;
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
  _count: { deals: number; contacts: number };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const emptyDealForm = {
  title: "",
  value: 0,
  stageId: "",
  contactId: "",
  contactName: "",
  probability: 0,
  expectedClose: "",
  notes: "",
};

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [form, setForm] = useState(emptyDealForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const { selectedOrg, loading: orgLoading } = useOrganization();

  const fetchPipeline = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);

      const response = await fetch(`/api/crm/pipelines?${params.toString()}`);
      if (response.ok) {
        const data: Pipeline[] = await response.json();
        const defaultPipeline = data.find(p => p.isDefault) || data[0] || null;
        setPipeline(defaultPipeline);
      }
    } catch (error) {
      console.error("Error loading pipeline:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (!orgLoading) fetchPipeline();
  }, [fetchPipeline, orgLoading]);

  const fetchContacts = useCallback(async (query: string) => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (query) params.set("search", query);
      const response = await fetch(`/api/crm/contacts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      fetchContacts("");
    }
  }, [dialogOpen, fetchContacts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contactSearch) fetchContacts(contactSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, fetchContacts]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !pipeline) return;

    const { draggableId, destination } = result;
    const newStageId = destination.droppableId;

    // Optimistic update
    setPipeline(prev => {
      if (!prev) return prev;
      const newStages = prev.stages.map(stage => {
        if (stage.id === newStageId) {
          const existingDeal = stage.deals.find(d => d.id === draggableId);
          if (existingDeal) return stage;
          // Find the deal in another stage
          const sourceStage = prev.stages.find(s => s.deals.some(d => d.id === draggableId));
          const deal = sourceStage?.deals.find(d => d.id === draggableId);
          if (!deal) return stage;
          return { ...stage, deals: [...stage.deals, { ...deal, stage: { id: newStageId, name: stage.name, color: stage.color, position: stage.position } }] };
        }
        // Remove from source stage
        const hasDeal = stage.deals.some(d => d.id === draggableId);
        if (hasDeal) {
          return { ...stage, deals: stage.deals.filter(d => d.id !== draggableId) };
        }
        return stage;
      });
      return { ...prev, stages: newStages };
    });

    try {
      await fetch(`/api/crm/deals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draggableId, stageId: newStageId }),
      });
    } catch {
      fetchPipeline(); // Revert on error
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.stageId) return;
    setSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        value: Number(form.value) || 0,
        stageId: form.stageId,
        contactId: form.contactId,
        pipelineId: pipeline?.id,
        probability: Number(form.probability) || 0,
        expectedClose: form.expectedClose || undefined,
        notes: form.notes.trim() || undefined,
        ...(selectedOrg && selectedOrg !== "all" ? { organizationId: selectedOrg } : {}),
      };

      if (editingDeal) {
        await fetch(`/api/crm/deals`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingDeal.id, ...payload }),
        });
      } else {
        await fetch(`/api/crm/deals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      setEditingDeal(null);
      setForm(emptyDealForm);
      fetchPipeline();
    } catch (error) {
      console.error("Error saving deal:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/crm/deals?id=${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      fetchPipeline();
    } catch (error) {
      console.error("Error deleting deal:", error);
    }
  };

  const openNewDeal = (stageId?: string) => {
    setEditingDeal(null);
    setForm({ ...emptyDealForm, stageId: stageId || (pipeline?.stages[0]?.id || "") });
    setDialogOpen(true);
  };

  const openEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setForm({
      title: deal.title,
      value: deal.value,
      stageId: deal.stage.id,
      contactId: deal.contact.id,
      contactName: deal.contact.name,
      probability: deal.probability,
      expectedClose: deal.expectedClose ? deal.expectedClose.split("T")[0] : "",
      notes: deal.notes || "",
    });
    setDialogOpen(true);
  };

  const getStageTotal = (stage: Stage) => {
    return (stage.deals || []).reduce((sum, d) => sum + d.value, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">No se encontró pipeline para esta organización.</p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear primer deal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground mt-1">{pipeline.name} — {pipeline._count.deals} deals totales</p>
        </div>
        <Button onClick={() => openNewDeal()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Deal
        </Button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
          {pipeline.stages.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-[300px] md:w-[320px]">
              <div className="bg-muted/50 rounded-t-xl p-3 border border-b-0 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-medium text-foreground text-sm">{stage.name}</span>
                    <Badge variant="secondary" className="text-xs">{(stage.deals || []).length}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{formatCurrency(getStageTotal(stage))}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNewDeal(stage.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] rounded-b-xl border border-border bg-card p-2 space-y-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : ""
                    }`}
                  >
                    {stage.deals?.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`rounded-lg border border-border bg-card p-3 transition-shadow cursor-pointer hover:shadow-sm ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                            }`}
                            onClick={() => openEditDeal(deal)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <h4 className="text-sm font-medium text-foreground truncate">{deal.title}</h4>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 ml-6">
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    {deal.contact.name}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0 text-red-400 hover:text-red-500"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(deal.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-2 ml-6">
                              <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value)}</span>
                              <div className="flex items-center gap-2">
                                {deal.probability > 0 && (
                                  <Badge variant="outline" className="text-xs">{deal.probability}%</Badge>
                                )}
                                {deal.expectedClose && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(deal.expectedClose)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {stage.deals?.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center py-8 text-muted-foreground text-xs">
                        Arrastra deals aquí
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => setDeleteConfirm(open ? deleteConfirm : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar deal?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Deal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "Editar Deal" : "Nuevo Deal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deal-title">Título *</Label>
              <Input
                id="deal-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nombre del deal"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deal-value">Valor (€)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="deal-probability">Probabilidad (%)</Label>
                <Input
                  id="deal-probability"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="deal-stage">Etapa *</Label>
              <Select value={form.stageId} onValueChange={(v) => setForm({ ...form, stageId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {pipeline.stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deal-contact">Contacto *</Label>
              {editingDeal ? (
                <Input value={form.contactName} disabled />
              ) : (
                <>
                  <Input
                    placeholder="Buscar contacto..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar contacto" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.email ? `(${c.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div>
              <Label htmlFor="deal-close">Fecha cierre estimada</Label>
              <Input
                id="deal-close"
                type="date"
                value={form.expectedClose}
                onChange={(e) => setForm({ ...form, expectedClose: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="deal-notes">Notas</Label>
              <textarea
                id="deal-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas del deal..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.title.trim() || !form.contactId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDeal ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
