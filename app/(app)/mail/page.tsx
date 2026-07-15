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
  Menu,
  X,
  Plus,
  SendHorizontal,
  MailOpen,
  Calendar,
  User,
  Info,
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
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
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

  // Setup form states
  const [host, setHost] = useState("imap.gmail.com");
  const [port, setPort] = useState(993);
  const [emailAddr, setEmailAddr] = useState("");
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(true);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inbox & List states
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Compose mail states
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Auto-guess SMTP settings when host changes
  useEffect(() => {
    if (host.includes("gmail.com")) {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setSmtpSecure(false);
    } else if (host.includes("outlook.com") || host.includes("office365.com")) {
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
      setSmtpSecure(false);
    } else if (host && host.startsWith("imap.")) {
      setSmtpHost(host.replace(/^imap\./i, "smtp."));
    } else if (host && !host.startsWith("imap.")) {
      setSmtpHost("smtp." + host);
    }
  }, [host]);

  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/mail/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || null);
        if (data.config) {
          setHost(data.config.host || "imap.gmail.com");
          setPort(data.config.port || 993);
          setEmailAddr(data.config.email || "");
          setUseSsl(data.config.ssl !== false);
          setSmtpHost(data.config.smtpHost || "smtp.gmail.com");
          setSmtpPort(data.config.smtpPort || 587);
          setSmtpSecure(data.config.smtpSecure === true);
        }
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeFolder]);

  const handleSaveConfig = async () => {
    if (!host || !emailAddr || !password) {
      toast.error("Servidor IMAP, email y contraseña son requeridos");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mail/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port,
          email: emailAddr,
          password,
          ssl: useSsl,
          smtpHost,
          smtpPort,
          smtpSecure,
        }),
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

  const handleSendEmail = async () => {
    if (!composeTo.trim()) {
      toast.error("Por favor ingresa un destinatario");
      return;
    }
    if (!composeBody.trim()) {
      toast.error("El cuerpo del correo no puede estar vacío");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim() || "(Sin asunto)",
          body: composeBody,
        }),
      });

      if (res.ok) {
        toast.success("Correo enviado exitosamente");
        setComposeOpen(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        if (activeFolder === "Sent") {
          loadEmails("Sent");
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al enviar el correo");
      }
    } catch {
      toast.error("Error de conexión al enviar el correo");
    } finally {
      setSendingEmail(false);
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

  // Setup/Settings form elements
  const setupForm = (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="text-center mb-4">
        <Mail className="h-10 w-10 mx-auto text-[var(--mediterranean-terracotta)] mb-2" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cuentas de Correo Corporativo</h3>
        <p className="text-xs text-slate-500">Configura tu conexión IMAP y SMTP para leer y redactar correos.</p>
      </div>

      <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">1. Servidor de Entrada (IMAP)</h4>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 text-xs">Servidor IMAP</Label>
          <Input
            placeholder="imap.gmail.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Puerto IMAP</Label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 993)}
              className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">SSL seguro (IMAP)</Label>
            <div className="flex items-center h-10">
              <Switch checked={useSsl} onCheckedChange={setUseSsl} className="data-[state=checked]:bg-indigo-600" />
              <span className="ml-2 text-xs text-slate-500">
                {useSsl ? "Activado" : "Desactivado"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">2. Servidor de Salida (SMTP)</h4>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 text-xs">Servidor SMTP</Label>
          <Input
            placeholder="smtp.gmail.com"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Puerto SMTP</Label>
            <Input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
              className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">SSL directo (SMTP)</Label>
            <div className="flex items-center h-10">
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} className="data-[state=checked]:bg-indigo-600" />
              <span className="ml-2 text-xs text-slate-500">
                {smtpSecure ? "SSL (Port 465)" : "TLS/STARTTLS (587)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">3. Credenciales de la Cuenta</h4>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 text-xs">Dirección de Email</Label>
          <Input
            type="email"
            placeholder="hola@miempresa.com"
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 text-xs">Contraseña o Clave de Aplicación</Label>
          <Input
            type="password"
            placeholder="Introduce tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
          />
        </div>
      </div>

      <Button
        onClick={handleSaveConfig}
        className="w-full mt-6 bg-[var(--mediterranean-terracotta)] hover:bg-[var(--mediterranean-terracotta)]/90 text-white font-medium shadow"
        disabled={saving}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Probando conexión...
          </>
        ) : (
          "Conectar y Guardar Configuración"
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

  // Setup required
  if (!config || showSetup) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-800 shadow-xl rounded-xl">
          <CardContent className="p-6">{setupForm}</CardContent>
        </Card>
      </div>
    );
  }

  // Normal view
  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Mail className="h-6 w-7 text-indigo-600 dark:text-indigo-400" />
            Correo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{config.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loadingEmails}
            className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingEmails && "animate-spin")} />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHost(config.host);
              setPort(config.port);
              setEmailAddr(config.email);
              setUseSsl(config.ssl);
              setSmtpHost(config.smtpHost || "");
              setSmtpPort(config.smtpPort || 587);
              setSmtpSecure(config.smtpSecure === true);
              setPassword("");
              setShowSettings(true);
            }}
            className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900"
          >
            <Settings className="h-4 w-4 mr-2" />
            <span>Configuración</span>
          </Button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu trigger */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg shrink-0">
        <button onClick={() => setMobileMenuOpen(true)} className="p-1 text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold text-sm text-slate-850 dark:text-slate-200">
          {folders.find(f => f.name === activeFolder)?.label || "Bandeja"}
        </span>
        <Button
          size="sm"
          onClick={() => setComposeOpen(true)}
          className="h-8 bg-indigo-600 hover:bg-indigo-755 text-white flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Redactar</span>
        </Button>
      </div>

      {/* Main Mail Grid Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Panel 1: Folder Sidebar */}
        <div className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-white dark:bg-slate-900 border-r border-slate-250 dark:border-slate-800 transition-transform duration-300 flex flex-col",
          mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-0",
          "md:translate-x-0 md:w-52 md:static md:h-full md:border-0 shrink-0"
        )}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 md:hidden shrink-0">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Carpetas</span>
            <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col p-2 space-y-4 min-h-0 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {/* Desktop compose button */}
            <Button
              onClick={() => setComposeOpen(true)}
              className="hidden md:flex w-full items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg shadow-sm transition-colors text-sm"
            >
              <FileEdit className="h-4 w-4" />
              Redactar
            </Button>

            <div className="space-y-1">
              {folders.map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.name;
                return (
                  <button
                    key={folder.name}
                    onClick={() => handleFolderChange(folder.name)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all",
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {folder.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel 2: Email List */}
        <div
          className={cn(
            "flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden",
            selectedEmail ? "hidden lg:flex lg:w-96" : "flex-1",
            !selectedEmail && "flex-1"
          )}
        >
          {/* List header */}
          <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Mensajes</span>
            <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-400 rounded-full font-semibold">
              {emails.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-150 dark:divide-slate-800/80">
            {loadingEmails ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-400">Buscando correos...</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                <Inbox className="h-8 w-8 opacity-40 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs">No hay mensajes en esta carpeta</span>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <button
                    key={email.id}
                    onClick={() => openEmail(email)}
                    className={cn(
                      "w-full text-left p-3.5 flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800/30",
                      isSelected && "bg-slate-100/70 dark:bg-slate-800/40 border-l-2 border-indigo-600",
                      !email.read && !isSelected && "bg-indigo-50/15 dark:bg-indigo-950/5"
                    )}
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {!email.read && (
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0" />
                        )}
                        <p
                          className={cn(
                            "text-xs truncate max-w-[170px]",
                            !email.read ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-500 dark:text-slate-450"
                          )}
                        >
                          {email.from.replace(/<.*>/, "").trim() || email.from}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {new Date(email.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    
                    <p
                      className={cn(
                        "text-xs font-semibold truncate mt-1 text-slate-800 dark:text-slate-200",
                        !email.read && "text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {email.subject}
                    </p>
                    
                    {email.snippet && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-1 leading-normal">
                        {email.snippet}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 3: Email Detail */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden",
          !selectedEmail && "hidden lg:flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/20"
        )}>
          {!selectedEmail ? (
            <div className="text-center p-8 max-w-sm">
              <MailOpen className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Selecciona un mensaje</h3>
              <p className="text-xs text-slate-400 mt-1">Haz clic en cualquier correo de la lista de la izquierda para ver su contenido completo.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Back button (Mobile view) */}
              <div className="p-3 bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEmail(null)}
                  className="text-slate-600 dark:text-slate-400 h-8 text-xs font-semibold hover:bg-slate-200/50 dark:hover:bg-slate-800/50 lg:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Volver
                </Button>
                <div className="hidden lg:block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Lectura de Correo
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400">Cargando contenido del correo...</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto">
                  {/* Subject */}
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                      {selectedEmail.subject}
                    </h2>
                  </div>

                  {/* Metadata cards */}
                  <div className="flex flex-wrap gap-2 text-xs bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800/80">
                    <div className="flex items-center gap-1 text-slate-500">
                      <User className="h-3.5 w-3.5 text-indigo-650 dark:text-indigo-400 shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-350">De:</span>
                      <span className="text-slate-800 dark:text-slate-200 select-all truncate max-w-[280px]" title={selectedEmail.from}>
                        {selectedEmail.from}
                      </span>
                    </div>
                    {selectedEmail.to && (
                      <div className="flex items-center gap-1 text-slate-500 w-full">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">Para:</span>
                        <span className="text-slate-850 dark:text-slate-200 select-all truncate" title={selectedEmail.to}>
                          {selectedEmail.to}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-500 w-full mt-0.5 pt-0.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      <Calendar className="h-3.5 w-3.5 text-indigo-650 dark:text-indigo-400 shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-350">Fecha:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {new Date(selectedEmail.date).toLocaleString("es-ES")}
                      </span>
                    </div>
                  </div>

                  {/* Content (HTML IFrame or Plain text) */}
                  <div className="flex-1 min-h-[350px] flex flex-col">
                    {selectedEmail.html ? (
                      <iframe
                        title="Email content"
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta charset="utf-8">
                              <style>
                                body {
                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                  font-size: 14px;
                                  line-height: 1.6;
                                  color: #334155;
                                  background-color: #ffffff;
                                  margin: 0;
                                  padding: 10px;
                                }
                                a { color: #2563eb; text-decoration: underline; }
                                img { max-width: 100%; height: auto; }
                                @media (prefers-color-scheme: dark) {
                                  body {
                                    color: #cbd5e1;
                                    background-color: #0f172a;
                                  }
                                  a { color: #60a5fa; }
                                }
                              </style>
                            </head>
                            <body>
                              ${selectedEmail.html}
                            </body>
                          </html>
                        `}
                        className="w-full flex-1 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 shadow-sm"
                      />
                    ) : (
                      <div className="w-full flex-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-lg border border-slate-150 dark:border-slate-800/80 font-sans leading-relaxed overflow-auto">
                        {selectedEmail.body}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-lg rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100 text-lg">Configuración de Correo</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Modifica la conexión IMAP y SMTP de tu cuenta corporativa.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">{setupForm}</div>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-lg rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2 text-base">
              <FileEdit className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Redactar Nuevo Correo
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Envía un email vía SMTP desde tu cuenta configurada ({config.email}).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300 text-xs">Para (Destinatario)</Label>
              <Input
                type="email"
                placeholder="destinatario@ejemplo.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300 text-xs">Asunto</Label>
              <Input
                placeholder="Escribe el título del asunto"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300 text-xs">Mensaje</Label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Escribe el cuerpo de tu correo aquí..."
                rows={8}
                className="w-full text-sm p-3 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 leading-relaxed resize-none"
              />
            </div>

            <Button
              onClick={handleSendEmail}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 shadow"
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando correo...
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
                  Enviar Correo
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
