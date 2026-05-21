"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Music, Upload, FileText, Headphones, ExternalLink } from "lucide-react";

interface ArtistProfile {
  id: string;
  stageName: string | null;
  genre: string | null;
  techUrl: string | null;
  techName: string | null;
  hospitalityUrl: string | null;
  hospitalityName: string | null;
  spotifyUrl: string | null;
  soundcloudUrl: string | null;
  instagramUrl: string | null;
  bio: string | null;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(true);
  const [savingArtist, setSavingArtist] = useState(false);

  const [stageName, setStageName] = useState("");
  const [genre, setGenre] = useState("");
  const [bio, setBio] = useState("");
  const [spotifyUrl, setUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [techUrl, setTechUrl] = useState("");
  const [techName, setTechName] = useState("");
  const [hospitalityUrl, setHospitalityUrl] = useState("");
  const [hospitalityName, setHospitalityName] = useState("");

  useEffect(() => {
    fetch("/api/artist-profile")
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (p) {
          setArtistProfile(p);
          setStageName(p.stageName || "");
          setGenre(p.genre || "");
          setBio(p.bio || "");
          setUrl(p.spotifyUrl || "");
          setSoundcloudUrl(p.soundcloudUrl || "");
          setInstagramUrl(p.instagramUrl || "");
          setTechUrl(p.techUrl || "");
          setTechName(p.techName || "");
          setHospitalityUrl(p.hospitalityUrl || "");
          setHospitalityName(p.hospitalityName || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingArtist(false));
  }, []);

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

  const handleSaveArtist = async () => {
    setSavingArtist(true);
    try {
      const res = await fetch("/api/artist-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageName: stageName || null,
          genre: genre || null,
          bio: bio || null,
          spotifyUrl: spotifyUrl || null,
          soundcloudUrl: soundcloudUrl || null,
          instagramUrl: instagramUrl || null,
          techUrl: techUrl || null,
          techName: techName || null,
          hospitalityUrl: hospitalityUrl || null,
          hospitalityName: hospitalityName || null,
        }),
      });
      if (res.ok) {
        toast.success("Perfil de cliente guardado");
        const updated = await res.json();
        setArtistProfile(updated);
      } else {
        toast.error("Error al guardar");
      }
    } catch { toast.error("Error de conexión"); }
    finally { setSavingArtist(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Configuración</h1>

      {/* Artist Profile */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Music className="h-5 w-5 text-purple-500" /> Perfil de Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingArtist ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre artístico</Label>
                  <Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder=" / Producer name" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
                </div>
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Techno, House, EDM..." className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tu bio para press kits y contratos..." rows={3} className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Headphones className="h-3.5 w-3.5" /> </Label>
                <Input value={spotifyUrl} onChange={(e) => setUrl(e.target.value)} placeholder="https://open.spotify.com/artist/..." className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Soundcloud</Label>
                  <Input value={soundcloudUrl} onChange={(e) => setSoundcloudUrl(e.target.value)} placeholder="https://soundcloud.com/..." className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
                </div>
              </div>
              <Button onClick={handleSaveArtist} disabled={savingArtist}>
                {savingArtist && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Perfil de Cliente
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/*  Técnico & Hospitality */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />  Técnico & Hospitality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Sube tus s. Se adjuntarán automáticamente cuando confirmes un oportunidad en el CRM Pipeline.</p>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />  Técnico (PDF)
              </Label>
              {techUrl ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{techName || "tech_.pdf"}</span>
                  <a href={techUrl} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Ver</a>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => { setTechUrl(""); setTechName(""); }}>Quitar</Button>
                </div>
              ) : null}
              <Input value={techUrl} onChange={(e) => setTechUrl(e.target.value)} placeholder="Pega la URL de tu  técnico (PDF)" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              <Input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Nombre del archivo (ej: _tecnico_v2.pdf)" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" /> Hospitality 
              </Label>
              {hospitalityUrl ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{hospitalityName || "hospitality.pdf"}</span>
                  <a href={hospitalityUrl} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Ver</a>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => { setHospitalityUrl(""); setHospitalityName(""); }}>Quitar</Button>
                </div>
              ) : null}
              <Input value={hospitalityUrl} onChange={(e) => setHospitalityUrl(e.target.value)} placeholder="Pega la URL de tu hospitality " className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
              <Input value={hospitalityName} onChange={(e) => setHospitalityName(e.target.value)} placeholder="Nombre del archivo (ej: hospitality_.pdf)" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
            </div>
          </div>
          <Button onClick={handleSaveArtist} disabled={savingArtist}>
            {savingArtist && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar s
          </Button>
        </CardContent>
      </Card>

      {/* User Profile */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
            <Input id="email" type="email" defaultValue={session?.user?.email || ""} disabled className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-100">Cambiar Contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Contraseña actual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Confirmar nueva contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600" />
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
