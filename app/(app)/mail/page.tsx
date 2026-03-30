"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  Settings,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Loader2,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailConfig {
  id: string;
  host: string;
  port: number;
  email: string;
  ssl: boolean;
}

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  read: boolean;
  snippet: string;
}

interface EmailDetail extends EmailItem {
  to: string;
  body: string;
  html?: string;
}

const folders = [
  { name: "INBOX", label: "Entrada", icon: Inbox },
  { name: "Sent", label: "Enviados", icon: Send },
  { name: "Drafts", label: "Borradores", icon: FileEdit },
  { name: "Trash", label: "Papelera", icon: Trash2 },
];

export default function MailPage() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Setup form
  const [host, setHost] = useState("imap.gmail.com");
  const [port, setPort] = useState(993);
  const [emailAddr, setEmailAddr] = useState("");
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inbox
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/mail/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || null);
        if (!data.configured) {
          setShowSetup(true);
        }
      }
    } catch {
      toast.error("Error al verificar configuración");
    } finally {
      setCheckingConfig(false);
    }
  }, []);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  const loadEmails = useCallback(async (folder?: string) => {
    setLoadingEmails(true);
    try {
      const res = await fetch(`/api/mail/inbox?folder=${folder || activeFolder}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setEmails(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al cargar emails");
      }
    } catch {
      toast.error("Error al cargar emails");
    } finally {
      setLoadingEmails(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    if (config) {
      loadEmails();
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveConfig = async () => {
    if (!host || !emailAddr || !password) {
      toast.error("Servidor, email y contraseña son requeridos");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mail/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, email: emailAddr, password, ssl: useSsl }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setShowSetup(false);
        setShowSettings(false);
        toast.success("Configuración guardada y conectado");
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar configuración");
      }
    } catch {
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const openEmail = async (email: EmailItem) => {
    setLoadingDetail(true);
    setSelectedEmail({ ...email, to: "", body: "" });
    try {
      const res = await fetch(`/api/mail/${email.id}?folder=${activeFolder}`);
      if (res.ok) {
        const detail: EmailDetail = await res.json();
        setSelectedEmail(detail);
      }
    } catch {
      toast.error("Error al cargar email");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleFolderChange = (folder: string) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    loadEmails(folder);
  };

  const handleRefresh = () => {
    setSelectedEmail(null);
    loadEmails();
  };

  // Setup form component
  const setupForm = (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center mb-6">
        <Mail className="h-12 w-12 mx-auto text-indigo-500 mb-3" />
        <h2 className="text-2xl font-bold text-foreground">Configurar Email</h2>
        <p className="text-muted-foreground mt-1">
          Conecta tu cuenta de email vía IMAP
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Servidor IMAP</Label>
        <Input
          placeholder="imap.gmail.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="bg-card border-border text-foreground"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground">Puerto</Label>
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 993)}
            className="bg-card border-border text-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Usar SSL</Label>
          <div className="flex items-center h-10">
            <Switch checked={useSsl} onCheckedChange={setUseSsl} />
            <span className="ml-2 text-sm text-muted-foreground">
              {useSsl ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Email</Label>
        <Input
          type="email"
          placeholder="hola@midominio.com"
          value={emailAddr}
          onChange={(e) => setEmailAddr(e.target.value)}
          className="bg-card border-border text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Contraseña / App Password</Label>
        <Input
          type="password"
          placeholder="Tu contraseña de aplicación"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-card border-border text-foreground"
        />
      </div>
      <Button
        onClick={handleSaveConfig}
        className="w-full mt-4"
        disabled={saving}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Conectando...
          </>
        ) : (
          "Conectar y guardar"
        )}
      </Button>
    </div>
  );

  if (checkingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No config: show setup
  if (!config || showSetup) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="w-full max-w-lg bg-card border-border">
          <CardContent className="p-6">{setupForm}</CardContent>
        </Card>
      </div>
    );
  }

  // Inbox view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mail</h1>
          <p className="text-muted-foreground mt-1">{config.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loadingEmails}
            className="border-border text-foreground"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingEmails && "animate-spin")} />
            Refrescar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHost(config.host);
              setPort(config.port);
              setEmailAddr(config.email);
              setUseSsl(config.ssl);
              setPassword("");
              setShowSettings(true);
            }}
            className="border-border text-foreground"
          >
            <Settings className="h-4 w-4 mr-2" />
            Config
          </Button>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Folder sidebar */}
        <div className="w-48 flex-shrink-0">
          <Card className="bg-card border-border h-full">
            <CardContent className="p-2 space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => handleFolderChange(folder.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeFolder === folder.name
                      ? "bg-indigo-500 text-white dark:bg-indigo-600"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <folder.icon className="h-4 w-4 flex-shrink-0" />
                  {folder.label}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Email list */}
        <div
          className={cn(
            "flex-shrink-0 overflow-y-auto",
            selectedEmail ? "w-80" : "flex-1"
          )}
        >
          <Card className="bg-card border-border h-full">
            <CardContent className="p-0">
              {loadingEmails ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Mail className="h-10 w-10 mb-3" />
                  <p className="text-sm">No hay emails</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => openEmail(email)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-accent transition-colors",
                        selectedEmail?.id === email.id && "bg-accent",
                        !email.read && "bg-accent/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            "text-sm truncate max-w-[200px]",
                            !email.read
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {email.from.replace(/<.*>/, "").trim() || email.from}
                        </p>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {new Date(email.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-sm truncate mt-0.5",
                          !email.read
                            ? "font-medium text-foreground"
                            : "text-foreground"
                        )}
                      >
                        {email.subject}
                      </p>
                      {email.snippet && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.snippet}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email detail */}
        {selectedEmail && (
          <div className="flex-1 overflow-y-auto">
            <Card className="bg-card border-border h-full">
              <CardContent className="p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEmail(null)}
                  className="mb-3 text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-3">
                      {selectedEmail.subject}
                    </h2>
                    <div className="space-y-1 text-sm text-muted-foreground mb-4">
                      <p>
                        <span className="font-medium text-foreground">De:</span>{" "}
                        {selectedEmail.from}
                      </p>
                      {selectedEmail.to && (
                        <p>
                          <span className="font-medium text-foreground">Para:</span>{" "}
                          {selectedEmail.to}
                        </p>
                      )}
                      <p>
                        <span className="font-medium text-foreground">Fecha:</span>{" "}
                        {new Date(selectedEmail.date).toLocaleString()}
                      </p>
                    </div>
                    <Separator className="my-4" />
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: selectedEmail.html || selectedEmail.body.replace(/\n/g, "<br />"),
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Configuración IMAP</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Actualiza tu configuración de email
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">{setupForm}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
