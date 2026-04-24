"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, Search, Trash2, Edit2, Users, Phone, Mail, Building2, X,
} from "lucide-react";
import { useOrganization } from "@/lib/organization-context";

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
  _count: { deals: number; activities: number };
  createdAt: string;
  updatedAt: string;
}

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

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
  tags: "",
  status: "LEAD" as const,
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { selectedOrg, loading: orgLoading } = useOrganization();

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedOrg && selectedOrg !== "all") params.set("organizationId", selectedOrg);

      const response = await fetch(`/api/crm/contacts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedOrg]);

  useEffect(() => {
    if (!orgLoading) fetchContacts();
  }, [fetchContacts, orgLoading]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        status: form.status,
        ...(selectedOrg && selectedOrg !== "all" ? { organizationId: selectedOrg } : {}),
      };

      if (editingContact) {
        await fetch(`/api/crm/contacts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingContact.id, ...payload }),
        });
      } else {
        await fetch(`/api/crm/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      setEditingContact(null);
      setForm(emptyForm);
      fetchContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      notes: contact.notes || "",
      tags: contact.tags.join(", "),
      status: contact.status as typeof emptyForm.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/crm/contacts?id=${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      fetchContacts();
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

  const openNewContact = () => {
    setEditingContact(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contactos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus clientes y prospectos</p>
        </div>
        <Button onClick={openNewContact}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Contacto
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email, empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contact List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Sin contactos</h3>
            <p className="text-muted-foreground mt-1">Empieza añadiendo tu primer contacto</p>
            <Button className="mt-4" onClick={openNewContact}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Contacto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id} className="bg-card border-border hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push(`/crm/contacts/${contact.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium flex-shrink-0">
                      {contact.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{contact.name}</h3>
                        <Badge className={statusColors[contact.status]}>{statusLabels[contact.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap text-sm text-muted-foreground">
                        {contact.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </span>
                        )}
                        {contact.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {contact.company}
                          </span>
                        )}
                      </div>
                      {contact.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {contact._count.deals} deals · {contact._count.activities} act.
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(contact); }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Dialog open={deleteConfirm === contact.id} onOpenChange={(open) => setDeleteConfirm(open ? contact.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>¿Eliminar contacto?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          Se eliminará <strong>{contact.name}</strong> y todos sus deals y actividades asociados. Esta acción no se puede deshacer.
                        </p>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                          </DialogClose>
                          <Button variant="destructive" onClick={() => handleDelete(contact.id)}>
                            Eliminar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Nombre de la empresa"
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof emptyForm.status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tags">Tags (separados por coma)</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="vip, urgente, sector-tech"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingContact ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
