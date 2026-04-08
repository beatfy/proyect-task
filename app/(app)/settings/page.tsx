"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al guardar");
        return;
      }
      await updateSession({ name: data.name });
      toast.success("Perfil actualizado");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Todos los campos son requeridos");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al cambiar contraseña");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
        Configuración
      </h1>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={session?.user?.email || ""}
              disabled
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Cambiar Contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-slate-700 dark:text-slate-300">Contraseña actual</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-slate-700 dark:text-slate-300">Nueva contraseña</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300">Confirmar nueva contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
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
