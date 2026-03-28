"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">
        Configuración
      </h1>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700">Nombre</Label>
            <Input
              id="name"
              defaultValue={session?.user?.name || ""}
              placeholder="Tu nombre"
              className="bg-white border-slate-300 text-slate-900"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={session?.user?.email || ""}
              disabled
              className="bg-slate-50 border-slate-200"
            />
          </div>
          <Button>Guardar Cambios</Button>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">
            Las preferencias de la aplicación se configurarán aquí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}