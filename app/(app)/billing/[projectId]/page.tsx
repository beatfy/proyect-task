"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, DollarSign, Save, Receipt, CheckCircle, Clock, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";

interface Invoice {
  id: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  paidAt: string | null;
  dueDate: string;
  createdAt: string;
  notes: string | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
  monthlyFee: number;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  PAID: { label: "Pagada", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  OVERDUE: { label: "Vencida", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

export default function ProjectBillingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyFee, setMonthlyFee] = useState("0");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ month: "", year: "", amount: "", dueDate: "", notes: "" });

  // Helper: get previous month info
  const getPrevMonth = () => {
    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();
    if (m === 0) { m = 12; y--; }
    const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { month: String(m), year: String(y), dueDate: due.toISOString().split("T")[0] };
  };

  useEffect(() => {
    fetchProject();
    fetchInvoices();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setMonthlyFee(String(data.monthlyFee || 0));
      }
    } catch {}
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/billing/invoices?projectId=${projectId}`);
      if (res.ok) setInvoices(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  const handleSaveFee = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/billing/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFee }),
      });
      if (res.ok) {
        toast.success("Cuota mensual actualizada");
        setProject(prev => prev ? { ...prev, monthlyFee: parseFloat(monthlyFee) } : null);
      }
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { toast.success("Estado actualizado"); fetchInvoices(); }
    } catch { toast.error("Error"); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Factura eliminada"); fetchInvoices(); }
    } catch { toast.error("Error"); }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId }),
      });
      if (res.ok) {
        toast.success("Factura creada");
        setCreateOpen(false);
        fetchInvoices();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error");
      }
    } catch { toast.error("Error"); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!project) return <p className="text-slate-500">Proyecto no encontrado</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/billing")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{project.name}</h1>
        </div>
      </div>

      {/* Monthly fee */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader><CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2"><DollarSign className="h-5 w-5" /> Cuota mensual</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">€</span>
              <Input type="number" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className="w-40 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
            <Button onClick={handleSaveFee} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturas</h2>
        <Button onClick={() => { const p = getPrevMonth(); setForm({ month: p.month, year: p.year, amount: "", dueDate: p.dueDate, notes: "" }); setCreateOpen(true); }}><Receipt className="h-4 w-4 mr-2" /> Nueva</Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardContent className="flex flex-col items-center py-12">
            <Receipt className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-500">No hay facturas para este proyecto</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const cfg = statusConfig[inv.status] || statusConfig.PENDING;
            return (
              <Card key={inv.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{monthNames[inv.month - 1]} {inv.year}</p>
                    <p className="text-sm text-slate-500">Emitida: {new Date(inv.createdAt || inv.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · Vence: {new Date(inv.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}{inv.notes && ` · ${inv.notes}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{inv.amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span>
                    <Badge className={cfg.color}>{cfg.label}</Badge>
                    {inv.status !== "PAID" && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(inv.id, "PAID")} className="text-green-600">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader><DialogTitle className="text-slate-900 dark:text-slate-100">Nueva Factura</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Mes</Label>
                <Input type="number" min="1" max="12" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} placeholder="1-12" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Año</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2025" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Importe (€)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">Vencimiento</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
            <Button onClick={handleCreate} className="w-full">Crear Factura</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
