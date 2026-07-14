"use client";

import { useState, useEffect } from "react";
import { Receipt, Loader2, Plus, DollarSign, Calendar, CheckCircle, Clock, AlertCircle, MoreHorizontal, Trash2, Zap, Pencil, Download, FileText } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [projects, setProjects] = useState<{
    id: string;
    name: string;
    monthlyFee: number;
    active?: boolean;
    clientEmail?: string | null;
    recurringInvoice?: boolean;
    billingDay?: number;
    invoiceEmailMsg?: string | null;
  }[]>([]);
  const [editingProject, setEditingProject] = useState<{
    projectId: string;
    monthlyFee: string;
    clientEmail: string;
    recurringInvoice: boolean;
    billingDay: string;
    invoiceEmailMsg: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [orgBilling, setOrgBilling] = useState<{
    billingName: string;
    billingTaxId: string;
    billingAddress: string;
    billingPhone: string;
    billingEmail: string;
    defaultIva: string;
    defaultIrpf: string;
    invoiceTemplate: string;
  } | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);

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
    fetchOrgBilling();
  }, []);

  const fetchOrgBilling = async () => {
    try {
      const res = await fetch("/api/billing/organization");
      if (res.ok) setOrgBilling(await res.json());
    } catch {}
  };

  const handleSaveOrgBilling = async () => {
    if (!orgBilling) return;
    setSavingOrg(true);
    try {
      const res = await fetch("/api/billing/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgBilling),
      });
      if (res.ok) {
        toast.success("Perfil de facturación de la empresa actualizado");
        fetchOrgBilling();
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setSavingOrg(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/billing/invoices${params}`);
      if (res.ok) {
        setInvoices(await res.json());
        setSelectedIds([]);
      }
    } catch { toast.error("Error al cargar facturas"); }
    finally { setLoading(false); }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(invoices.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "status", status }),
      });
      if (res.ok) {
        toast.success("Facturas actualizadas");
        setSelectedIds([]);
        fetchInvoices();
      } else {
        toast.error("Error al actualizar facturas");
      }
    } catch {
      toast.error("Error al actualizar facturas");
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar las ${selectedIds.length} facturas seleccionadas?`)) return;
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "delete" }),
      });
      if (res.ok) {
        toast.success("Facturas eliminadas");
        setSelectedIds([]);
        fetchInvoices();
      } else {
        toast.error("Error al eliminar facturas");
      }
    } catch {
      toast.error("Error al eliminar facturas");
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch {}
  };

  useEffect(() => { fetchInvoices(); }, [filterStatus]);

  const handleOpenSettings = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      setEditingProject({
        projectId,
        monthlyFee: String(proj.monthlyFee || "0"),
        clientEmail: proj.clientEmail || "",
        recurringInvoice: Boolean(proj.recurringInvoice),
        billingDay: String(proj.billingDay ?? "31"),
        invoiceEmailMsg: proj.invoiceEmailMsg || "",
      });
    }
  };

  const handleSaveSettings = async (projectId: string) => {
    if (!editingProject) return;
    try {
      const res = await fetch(`/api/billing/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyFee: editingProject.monthlyFee,
          clientEmail: editingProject.clientEmail,
          recurringInvoice: editingProject.recurringInvoice,
          billingDay: editingProject.billingDay,
          invoiceEmailMsg: editingProject.invoiceEmailMsg,
        }),
      });
      if (res.ok) {
        toast.success("Configuración de facturación actualizada");
        setEditingProject(null);
        fetchProjects();
        fetchInvoices();
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch {
      toast.error("Error al guardar la configuración");
    }
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

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Facturas
          </TabsTrigger>
          <TabsTrigger value="template" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Plantilla y Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">

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
                        <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Cliente</th>
                        <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Cuota mensual</th>
                        <th className="text-center py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regularProjects.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-2 font-medium text-slate-900 dark:text-slate-100">{p.name}</td>
                          <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                            <span className="mr-2">{fmt(p.monthlyFee)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 inline-flex align-middle" onClick={() => handleOpenSettings(p.id)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </td>
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

      {/* Select All / Bulk Actions */}
      {invoices.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.length === invoices.length && invoices.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {selectedIds.length > 0 ? `${selectedIds.length} seleccionadas` : "Seleccionar todas"}
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200 dark:border-green-900/50"
                onClick={() => handleBulkStatusChange("PAID")}
              >
                <CheckCircle className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Cobrar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50"
                onClick={() => handleBulkStatusChange("PENDING")}
              >
                <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Marcar pendiente</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/50"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Eliminar</span>
              </Button>
            </div>
          )}
        </div>
      )}

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
            const isSelected = selectedIds.includes(invoice.id);
            return (
              <Card key={invoice.id} className={`bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-colors ${isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelect(invoice.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
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
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleOpenSettings(invoice.projectId)}>
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
                          <DropdownMenuItem onClick={() => window.open(`/api/billing/invoices/${invoice.id}/pdf`, "_blank")}>
                            <Download className="h-4 w-4 mr-2" /> Descargar PDF
                          </DropdownMenuItem>
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

        </TabsContent>

        <TabsContent value="template">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                Perfil de Facturación de la Empresa
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">Configura los datos fiscales que aparecerán en las facturas emitidas a tus clientes</p>
            </CardHeader>
            <CardContent>
              {orgBilling ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Nombre / Razón Social</Label>
                        <Input
                          value={orgBilling.billingName || ""}
                          onChange={(e) => setOrgBilling({ ...orgBilling, billingName: e.target.value })}
                          placeholder="Ej. Mi Empresa S.L."
                          className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">NIF / CIF / Identificación Fiscal</Label>
                        <Input
                          value={orgBilling.billingTaxId || ""}
                          onChange={(e) => setOrgBilling({ ...orgBilling, billingTaxId: e.target.value })}
                          placeholder="Ej. B12345678"
                          className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Dirección Fiscal</Label>
                        <Input
                          value={orgBilling.billingAddress || ""}
                          onChange={(e) => setOrgBilling({ ...orgBilling, billingAddress: e.target.value })}
                          placeholder="Calle Mayor 123, Madrid"
                          className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">Teléfono</Label>
                          <Input
                            value={orgBilling.billingPhone || ""}
                            onChange={(e) => setOrgBilling({ ...orgBilling, billingPhone: e.target.value })}
                            placeholder="+34 600 000 000"
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">Email de Facturación</Label>
                          <Input
                            type="email"
                            value={orgBilling.billingEmail || ""}
                            onChange={(e) => setOrgBilling({ ...orgBilling, billingEmail: e.target.value })}
                            placeholder="facturas@miempresa.com"
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">IVA por defecto (%)</Label>
                          <Input
                            type="number"
                            value={orgBilling.defaultIva ?? "21"}
                            onChange={(e) => setOrgBilling({ ...orgBilling, defaultIva: e.target.value })}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-300">IRPF por defecto (%)</Label>
                          <Input
                            type="number"
                            value={orgBilling.defaultIrpf ?? "15"}
                            onChange={(e) => setOrgBilling({ ...orgBilling, defaultIrpf: e.target.value })}
                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Diseño de la Plantilla</Label>
                        <Select
                          value={orgBilling.invoiceTemplate || "modern"}
                          onValueChange={(v) => setOrgBilling({ ...orgBilling, invoiceTemplate: v })}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                            <SelectValue placeholder="Selecciona un diseño" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="modern">Moderno (Gris/Índigo profesional)</SelectItem>
                            <SelectItem value="minimalist">Minimalista (Limpio y blanco/negro)</SelectItem>
                            <SelectItem value="classic">Clásico (Corporativo tradicional)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between h-40">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Vista Previa de la Plantilla</h4>
                          <p className="text-xs text-slate-500 mt-1">Descarga un documento PDF de ejemplo con tus datos actuales para validar la apariencia de la factura.</p>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => window.open("/api/billing/invoices/sample/pdf", "_blank")}
                          className="w-full flex items-center justify-center gap-2 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                        >
                          <Download className="h-4 w-4" />
                          Descargar PDF de Ejemplo
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button onClick={handleSaveOrgBilling} disabled={savingOrg} className="w-full md:w-auto md:px-8">
                      {savingOrg ? "Guardando..." : "Guardar Perfil Fiscal"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit project billing settings dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => { if (!open) setEditingProject(null); }}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">
              Configuración de Facturación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Cuota mensual (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={editingProject?.monthlyFee || ""}
                onChange={(e) => editingProject && setEditingProject({ ...editingProject, monthlyFee: e.target.value })}
                placeholder="0.00"
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Email de facturación del cliente</Label>
              <Input
                type="email"
                value={editingProject?.clientEmail || ""}
                onChange={(e) => editingProject && setEditingProject({ ...editingProject, clientEmail: e.target.value })}
                placeholder="cliente@ejemplo.com"
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              />
            </div>

            <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">Facturación recurrente automática</Label>
                <p className="text-xs text-slate-500">Genera y envía automáticamente la factura por email</p>
              </div>
              <input
                type="checkbox"
                checked={editingProject?.recurringInvoice || false}
                onChange={(e) => editingProject && setEditingProject({ ...editingProject, recurringInvoice: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {editingProject?.recurringInvoice && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Día de facturación mensual</Label>
                  <Select
                    value={editingProject?.billingDay || "31"}
                    onValueChange={(v) => editingProject && setEditingProject({ ...editingProject, billingDay: v })}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                      <SelectValue placeholder="Selecciona un día" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Día {i + 1}
                        </SelectItem>
                      ))}
                      <SelectItem value="31">Último día del mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Mensaje de email personalizado</Label>
                  <textarea
                    value={editingProject?.invoiceEmailMsg || ""}
                    onChange={(e) => editingProject && setEditingProject({ ...editingProject, invoiceEmailMsg: e.target.value })}
                    placeholder="Escribe el mensaje que acompañará a la factura..."
                    rows={4}
                    className="w-full text-sm p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </>
            )}

            <Button onClick={() => editingProject && handleSaveSettings(editingProject.projectId)} className="w-full">
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>          <DialogTitle className="text-slate-900 dark:text-slate-100">Nueva Factura de Oportunidad</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">Cliente / Oportunidad</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                  <SelectValue placeholder="Seleccionar cliente" />
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
