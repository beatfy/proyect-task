"use client";

import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download,
} from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; name: string; error: string }[];
  totalRows: number;
  fieldMapping: Record<string, string>;
  sheetName: string;
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  onImportComplete: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  email: "Email",
  phone: "Teléfono",
  company: "Empresa",
  notes: "Notas",
  tags: "Tags",
  status: "Estado",
};

export default function ImportContactsDialog({
  open,
  onOpenChange,
  organizationId,
  onImportComplete,
}: ImportContactsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [defaultStatus, setDefaultStatus] = useState("LEAD");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.toLowerCase();
      if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
        toast.error("Formato no soportado. Usa CSV, XLSX o XLS.");
        return;
      }
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("defaultStatus", defaultStatus);
      formData.append("skipDuplicates", String(skipDuplicates));
      if (organizationId && organizationId !== "all") {
        formData.append("organizationId", organizationId);
      }

      const response = await fetch("/api/crm/contacts/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al importar");
        setImporting(false);
        return;
      }

      setResult(data);

      if (data.imported > 0) {
        toast.success(`${data.imported} contactos importados`);
        onImportComplete();
      }
    } catch {
      toast.error("Error de conexión al importar");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = "name,email,phone,company,notes,tags,status\nJuan García,juan@ejemplo.com,+34 600 111 222,Acme Corp,Cliente VIP,vip;tech,LEAD\nMaría López,maria@ejemplo.com,+34 600 333 444,Tech Sol,,,CONTACTED\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_contactos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contactos
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Importa contactos desde un archivo CSV o Excel (.xlsx, .xls). La primera fila debe contener los nombres de las columnas.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Descargar plantilla CSV
              </Button>
            </div>

            <div>
              <Label>Archivo</Label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Haz clic para seleccionar un archivo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV, XLSX o XLS
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado por defecto</Label>
                <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="CONTACTED">Contactado</SelectItem>
                    <SelectItem value="QUALIFIED">Cualificado</SelectItem>
                    <SelectItem value="CUSTOMER">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id="skip-duplicates"
                    checked={skipDuplicates}
                    onCheckedChange={setSkipDuplicates}
                  />
                  <Label htmlFor="skip-duplicates" className="text-sm cursor-pointer">
                    Saltar duplicados (email)
                  </Label>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Columnas reconocidas automáticamente:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-background border"
                  >
                    {label} ({key})
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {result.imported}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Importados</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {result.skipped}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">Duplicados</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {result.errors.length}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">Errores</div>
              </div>
            </div>

            {Object.keys(result.fieldMapping).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Mapeo detectado:</p>
                <div className="space-y-1">
                  {Object.entries(result.fieldMapping).map(([field, col]) => (
                    <div key={field} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-20">{FIELD_LABELS[field] || field}:</span>
                      <span className="font-mono bg-background px-1.5 py-0.5 rounded border">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-2">
                  Errores ({result.errors.length} de {result.totalRows} filas):
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs bg-red-50 dark:bg-red-900/10 rounded px-2 py-1 flex gap-2">
                      <span className="text-red-500">Fila {err.row}:</span>
                      <span>{err.name}</span>
                      <span className="text-red-600">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Hoja: {result.sheetName} · {result.totalRows} filas procesadas
            </p>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Importar otro archivo
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
