"use client";

import { useState, useEffect } from "react";
import { Receipt, Loader2, Plus, DollarSign, Calendar, CheckCircle, Clock, AlertCircle, MoreHorizontal, Trash2, Zap, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Link from "next/link";

interface Invoice {
  id: string;
  projectId: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  paidAt: string | null;
  dueDate: string;
  createdAt: string;
  notes: string | null;
  project: { id: string; name: string; color: string };
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  PAID: { label: "Pagada", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
  OVERDUE: { label: "Vencida", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertCircle },
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({ projectId: "", month: "", year: "", amount: "", dueDate: "", notes: "" });
  const [projects, setProjects] = useState<{ id: string; name: string; monthlyFee: number; active?: boolean }[]>([]);
  const [editingFee, setEditingFee] = useState<{ projectId: string; value: string } | null>(null);

  // Helper: get previous month info
  const getPrevMonth = () => {
    const now = new Date();
    let m = now.getMonth(); // 0-indexed = previous month
    let y = now.getFullYear();
    if (m === 0) { m = 12; y--; }
    const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { month: String(m), year: String(y), dueDate: due.toISOString().split("T")[0] };
  };

  useEffect(() => {
    fetchInvoices();
    fetchProjects();
  }, []);

  const fetchInvoices = async () => {
    try {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/billing/invoices${params}`);
      if (res.ok) setInvoices(await res.json());
    } catch { toast.error("Error al cargar facturas"); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch {}
  };

  useEffect(() => { fetchInvoices(); }, [filterStatus]);

  const handleSaveFee = async (projectId: string) => {
    if (!editingFee) return;
    try {
      const res = await fetch(`/api/billing/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFee: editingFee.value }),
      });
      if (res.ok) { toast.success("Cuota actualizada"); setEditingFee(null); fetchProjects(); }
      else { toast.error("Error al guardar cuota"); }
    } catch { toast.error("Error al guardar cuota"); }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Factura creada");
        setCreateOpen(false);
        const p = getPrevMonth();
        setForm({ projectId: "", month: p.month, year: p.year, amount: "", dueDate: p.dueDate, notes: "" });
        fetchInvoices();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear factura");
      }
    } catch { toast.error("Error al crear factura"); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { toast.success("Estado actualizado"); fetchInvoices(); }
    } catch { toast.error("Error al actualizar"); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Factura eliminada"); fetchInvoices(); }
    } catch { toast.error("Error al eliminar"); }
  };

  const handleAutoGenerate = async () => {
    try {
      const res = await fetch("/api/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.created} facturas generadas`);
        fetchInvoices();
      }
    } catch { toast.error("Error al generar facturas"); }
  };

  const totalPending = invoices.filter(i => i.status === "PENDING").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + i.amount, 0);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Facturación</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Gestiona las facturas de tus oportunidads y clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="shrink-0" onClick={handleAutoGenerate}>
            <Zap className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Auto-generar</span>
          </Button>
          <Button size="sm" className="shrink-0" onClick={() => { const p = getPrevMonth(); setForm({ projectId: "", month: p.month, year: p.year, amount: "", dueDate: p.dueDate, notes: "" }); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nueva Factura</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 dark:text-slate-400">Pendiente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{totalPending.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</p></CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 dark:text-slate-400">Cobrado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</p></CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 dark:text-slate-400">Total facturas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invoices.length}</p></CardContent>
        </Card>
      </div>

      {/* Clientes Regulares */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>        <CardTitle className="text-slate-900 dark:text-slate-100">Clientes Regulares / Salas Fijas</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const regularProjects = projects.filter(p => p.monthlyFee > 0);
            const bruto = regularProjects.reduce((s, p) => s + p.monthlyFee, 0);
            const iva = bruto * 0.21;
            const irpf = bruto * 0.15;
            const neto = bruto + iva - irpf;
            const fmt = (v: number) => v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
            return (
              <>
                {regularProjects.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">No hay clientes con cuota mensual configurada</p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm mb-4 min-w-[400px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Lanzamiento</th>
                        <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Cuota mensual</th>
                        <th className="text-center py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regularProjects.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-2 font-medium text-slate-900 dark:text-slate-100">{p.name}</td>
                          <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{fmt(p.monthlyFee)}</td>
                          <td className="py-2 px-2 text-center"><Badge className={p.active !== false ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}>{p.active !== false ? "Activo" : "Inactivo"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Bruto mensual:</span><span className="font-medium text-slate-900 dark:text-slate-100">{fmt(bruto)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">IVA 21%:</span><span className="text-blue-600">+{fmt(iva)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">IRPF -15%:</span><span className="text-red-500">-{fmt(irpf)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-1"><span className="font-medium text-slate-700 dark:text-slate-300">Neto mensual:</span><span className="font-bold text-green-600">{fmt(neto)}</span></div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", "PENDING", "PAID", "OVERDUE"].map((s) => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "all" ? "Todas" : statusConfig[s]?.label || s}
          </Button>
        ))}
      </div>

      {/* Invoices list */}
      {invoices.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardContent className="flex flex-col items-center py-12">
            <Receipt className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No hay facturas</h3>
            <p className="text-slate-500 text-sm">Crea facturas manualmente o auto-genera para proyectos con cuota mensual</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const cfg = statusConfig[invoice.status] || statusConfig.PENDING;
            return (
              <Card key={invoice.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: invoice.project.color }} />
                      <div className="min-w-0">
                        <Link href={`/billing/${invoice.projectId}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline block truncate">
                          {invoice.project.name}
                        </Link>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          <span className="font-medium">{monthShort[invoice.month - 1]} {invoice.year}</span>{' '}
                          · Vence: {new Date(invoice.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {invoice.amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </span>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                        const proj = projects.find(p => p.id === invoice.projectId);
                        setEditingFee({ projectId: invoice.projectId, value: String(proj?.monthlyFee || "") });
                      }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                          {invoice.status !== "PAID" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, "PAID")} className="text-green-600">
                              <CheckCircle className="h-4 w-4 mr-2" /> Marcar pagada
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "PAID" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice.id, "PENDING")} className="text-yellow-600">
                              <Clock className="h-4 w-4 mr-2" /> Marcar pendiente
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDelete(invoice.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit monthly fee dialog */}
      <Dialog open={!!editingFee} onOpenChange={(open) => { if (!open) setEditingFee(null); }}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader><DialogTitle className="text-slate-900 dark:text-slate-100">Editar cuota mensual</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Cuota mensual (€)</Label>
              <Input type="number" step="0.01" value={editingFee?.value || ""} onChange={(e) => editingFee && setEditingFee({ ...editingFee, value: e.target.value })} placeholder="0.00" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
            <Button onClick={() => editingFee && handleSaveFee(editingFee.projectId)} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>          <DialogTitle className="text-slate-900 dark:text-slate-100">Nueva Factura de Oportunidad</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Lanzamiento / Oportunidad</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                  <SelectValue placeholder="Seleccionar lanzamiento" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Mes</Label>
                <Select value={form.month} onValueChange={(v) => setForm({ ...form, month: v })}>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Año</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2025" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Importe (€)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Fecha vencimiento</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
            <Button onClick={handleCreate} className="w-full">Crear Factura</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
