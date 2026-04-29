"use client";

import { useState, useEffect } from "react";
import { Mail, Link, Copy, Check, Users, UserPlus, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Props {
  projectId: string;
  onClose?: () => void;
}

interface InviteToken {
  id: string;
  token: string;
  url: string;
  role: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
  creator: { name: string | null; email: string };
}

export default function InviteManager({ projectId, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [existingLinks, setExistingLinks] = useState<InviteToken[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchExistingLinks = async () => {
    try {
      const res = await fetch(`/api/invitations/link?projectId=${projectId}`);
      if (res.ok) {
        setExistingLinks(await res.json());
      }
    } catch (err) {
      console.error("Error fetching links:", err);
    }
  };

  // Load existing links on mount
  useEffect(() => {
    fetchExistingLinks();
  }, [projectId]);

  const handleEmailInvite = async () => {
    if (!email.trim()) {
      toast.error("Introduce un email");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, projectId, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al enviar invitación");
        return;
      }

      toast.success(`Invitación enviada a ${email}`);

      // Mostrar link mágico para copiar
      if (data.inviteUrl) {
        setInviteLink(data.inviteUrl);
      }

      setEmail("");
      if (onClose) onClose();
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role,
          expiresDays: 7,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al generar link");
        return;
      }

      setInviteLink(data.url);
      fetchExistingLinks();
      toast.success("Link generado");
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado al clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Error al copiar");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Sin límite";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    if (diffDays <= 0) return "Expirado";
    return `${diffDays} días`;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Por Email
          </TabsTrigger>
          <TabsTrigger value="link">
            <Link className="h-4 w-4 mr-2" />
            Por Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Email del invitado</Label>
            <Input
              type="email"
              placeholder="usuario@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Miembro</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleEmailInvite}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Enviar Invitación
          </Button>

          <p className="text-xs text-gray-500 text-center">
            El invitado recibirá una notificación en la app
          </p>
        </TabsContent>

        <TabsContent value="link" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Rol para los que usen el link</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Miembro</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerateLink}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            Generar Link
          </Button>

          {inviteLink && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium mb-2">Link generado:</p>
              <div className="flex items-center gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="bg-white dark:bg-gray-800"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(inviteLink)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Comparte este link por WhatsApp, Email, etc.
              </p>
            </div>
          )}

          {/* Existing links */}
          {existingLinks.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium mb-2 block">
                Links activos
              </Label>
              <div className="space-y-2">
                {existingLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{link.url}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Users className="h-3 w-3" />
                        <span>
                          {link.uses} usos
                          {link.maxUses && ` / ${link.maxUses} máximo`}
                        </span>
                        <Clock className="h-3 w-3 ml-2" />
                        <span>{formatDate(link.expiresAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(link.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}