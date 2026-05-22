"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, User, Lock, Building2, Globe, Mail, Phone } from "lucide-react";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    setName(session?.user?.name || "");
  }, [session]);

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); return; }
      await updateSession({ name: data.name });
      toast.success("Perfil actualizado");
    } catch { toast.error("Error de conexión"); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error("Todos los campos son requeridos"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPassword.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al cambiar contraseña"); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Contraseña actualizada");
    } catch { toast.error("Error de conexión"); }
    finally { setSavingPassword(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-foreground">Configuración</h1>

      {/* User Profile */}
      <Card className="card-mediterranean">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-[var(--mediterranean-terracotta)]" /> Perfil de Usuario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input id="email" type="email" defaultValue={session?.user?.email || ""} disabled className="bg-muted" />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card className="card-mediterranean">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--mediterranean-blue)]" /> Información de la Agencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Nombre de la agencia
            </Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="taskProject Agency" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-1">
              <Globe className="h-4 w-4" /> Sitio web
            </Label>
            <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://taskproject.app" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-1">
              <Phone className="h-4 w-4" /> Teléfono
            </Label>
            <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+34 600 000 000" />
          </div>
          <Button onClick={() => { toast.info("Función en desarrollo"); }} disabled={savingCompany}>
            {savingCompany && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Información
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="card-mediterranean">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-[var(--mediterranean-sage)]" /> Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Contraseña actual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Confirmar nueva contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-sm text-red-500">Las contraseñas no coinciden</p>
          )}
          <Button onClick={handleChangePassword} disabled={savingPassword} variant="outline">
            {savingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cambiar Contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
