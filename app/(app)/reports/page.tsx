"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckSquare, 
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Link2,
  Unlink,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useOrganization } from "@/lib/organization-context";

interface ReportStats {
  completedThisWeek: number;
  completedThisMonth: number;
  completedLastMonth: number;
  totalTimeThisWeek: number;
  totalTimeThisMonth: number;
  tasksByStatus: Record<string, number>;
  activeProjects: number;
  totalTasks: number;
  overdueTasks: number;
  pipelineValue: number;
  openDealsCount: number;
}

interface MetaMetrics {
  connected: boolean;
  adAccountName?: string;
  metrics?: {
    campaigns: number;
    totals: {
      spend: number;
      impressions: number;
      clicks: number;
    };
    period: string;
  };
  error?: string;
}

interface GAMetrics {
  connected: boolean;
  propertyName?: string;
  metrics?: {
    rows: number;
    totals: {
      sessions: number;
      activeUsers: number;
      pageViews: number;
    };
    period: string;
  };
  error?: string;
}

function ReportsContent() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [metaData, setMetaData] = useState<MetaMetrics | null>(null);
  const [gaData, setGaData] = useState<GAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [gaToken, setGaToken] = useState("");
  const [connectingGA, setConnectingGA] = useState(false);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const { selectedOrg } = useOrganization();
  const searchParams = useSearchParams();

  useEffect(() => {
    const metaConnected = searchParams.get("meta_connected");
    const metaError = searchParams.get("meta_error");

    if (metaConnected === "true") {
      toast.success("Meta Ads conectado correctamente");
      window.history.replaceState({}, "", "/reports");
    }
    if (metaError) {
      const errorMessages: Record<string, string> = {
        user_denied: "Cancelaste la autorización de Meta",
        no_code: "No se recibió el código de autorización",
        token_exchange: "Error al intercambiar el token con Meta",
        server_config: "Error de configuración del servidor",
        unknown: "Error desconocido al conectar con Meta",
      };
      toast.error(errorMessages[metaError] || "Error al conectar con Meta");
      window.history.replaceState({}, "", "/reports");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAllData();
  }, [selectedOrg]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") {
        params.set("organizationId", selectedOrg);
      }
      const statsRes = await fetch(`/api/reports/stats?${params.toString()}`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Fetch Meta data
      const metaRes = await fetch("/api/integrations/meta");
      if (metaRes.ok) {
        setMetaData(await metaRes.json());
      }

      // Fetch GA data
      const gaRes = await fetch("/api/integrations/google-analytics");
      if (gaRes.ok) {
        setGaData(await gaRes.json());
      }
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const connectMeta = async () => {
    setConnectingMeta(true);
    try {
      const appId = "26660198940346902";
      const redirectUri = `${window.location.origin}/api/integrations/meta/callback`;
      const scope = "ads_read,pages_show_list,pages_read_engagement,business_management";
      const authUrl =
        `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code`;
      window.location.href = authUrl;
    } catch (error) {
      toast.error("Error al iniciar conexión con Meta");
      console.error("Error connecting Meta:", error);
      setConnectingMeta(false);
    }
  };

  const connectGA = async () => {
    if (!gaToken) {
      toast.error("Introduce un token de acceso");
      return;
    }
    setConnectingGA(true);
    try {
      const res = await fetch("/api/integrations/google-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: gaToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setGaToken("");
        toast.success("✅ Google Analytics conectado correctamente");
        fetchAllData();
      } else {
        toast.error(data.error || "Error al conectar con Google Analytics");
      }
    } catch (error) {
      toast.error("Error de conexión con Google Analytics");
      console.error("Error connecting GA:", error);
    } finally {
      setConnectingGA(false);
    }
  };

  const disconnectMeta = async () => {
    try {
      await fetch("/api/integrations/meta", { method: "DELETE" });
      fetchAllData();
    } catch (error) {
      console.error("Error disconnecting Meta:", error);
    }
  };

  const disconnectGA = async () => {
    try {
      await fetch("/api/integrations/google-analytics", { method: "DELETE" });
      fetchAllData();
    } catch (error) {
      console.error("Error disconnecting GA:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0h 0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--mediterranean-terracotta)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-muted-foreground mt-1">
            Métricas y análisis de tu agencia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-mediterranean">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-[var(--mediterranean-terracotta)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              Proyectos en curso
            </p>
          </CardContent>
        </Card>

        <Card className="card-mediterranean">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tareas Totales</CardTitle>
            <CheckSquare className="h-4 w-4 text-[var(--mediterranean-blue)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overdueTasks || 0} vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="card-mediterranean">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--mediterranean-sage)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pipelineValue?.toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              }) || "0 €"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.openDealsCount || 0} oportunidades abiertas
            </p>
          </CardContent>
        </Card>

        <Card className="card-mediterranean">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Esta Semana</CardTitle>
            <Clock className="h-4 w-4 text-[var(--mediterranean-ocre)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(stats?.totalTimeThisWeek || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDuration(stats?.totalTimeThisMonth || 0)} este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meta Ads */}
        <Card className="card-mediterranean">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-[var(--mediterranean-terracotta)]" />
              Meta Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metaData?.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">{metaData.adAccountName || "Conectado"}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectMeta}>
                    <Unlink className="h-4 w-4 mr-1" /> Desconectar
                  </Button>
                </div>
                
                {metaData.metrics?.totals && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{metaData.metrics.totals.spend?.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) || "0 €"}</div>
                      <p className="text-xs text-muted-foreground">Gasto</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{(metaData.metrics.totals.impressions || 0).toLocaleString("es-ES")}</div>
                      <p className="text-xs text-muted-foreground">Impresiones</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{(metaData.metrics.totals.clicks || 0).toLocaleString("es-ES")}</div>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Conecta tu cuenta de Meta Business para ver métricas de campañas
                </p>
                <Button onClick={connectMeta} disabled={connectingMeta} className="w-full">
                  {connectingMeta ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo a Meta...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" /> Conectar con Meta
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Serás redirigido a Facebook para autorizar el acceso
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Analytics */}
        <Card className="card-mediterranean">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-[var(--mediterranean-blue)]" />
              Google Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {gaData?.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">{gaData.propertyName || "Conectado"}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectGA}>
                    <Unlink className="h-4 w-4 mr-1" /> Desconectar
                  </Button>
                </div>
                
                {gaData.metrics?.totals && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{(gaData.metrics.totals.sessions || 0).toLocaleString("es-ES")}</div>
                      <p className="text-xs text-muted-foreground">Sesiones</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{(gaData.metrics.totals.activeUsers || 0).toLocaleString("es-ES")}</div>
                      <p className="text-xs text-muted-foreground">Usuarios</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-lg font-bold">{(gaData.metrics.totals.pageViews || 0).toLocaleString("es-ES")}</div>
                      <p className="text-xs text-muted-foreground">Pageviews</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Conecta tu property de GA4 para ver métricas de tráfico
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Access Token de Google"
                    value={gaToken}
                    onChange={(e) => setGaToken(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                  <Button onClick={connectGA} disabled={!gaToken || connectingGA}>
                    {connectingGA ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Conectando...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-1" /> Conectar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtén tu token en: console.cloud.google.com/apis/credentials
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-mediterranean">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[var(--mediterranean-terracotta)]" />
              Estado de Tareas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.tasksByStatus && (
              <div className="space-y-3">
                {Object.entries(stats.tasksByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`
                          ${status === "TODO" ? "bg-slate-100 text-slate-700" : ""}
                          ${status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : ""}
                          ${status === "IN_REVIEW" ? "bg-yellow-100 text-yellow-700" : ""}
                          ${status === "DONE" ? "bg-green-100 text-green-700" : ""}
                        `}
                      >
                        {status === "TODO" && "Por Hacer"}
                        {status === "IN_PROGRESS" && "En Progreso"}
                        {status === "IN_REVIEW" && "En Revisión"}
                        {status === "DONE" && "Completadas"}
                      </Badge>
                    </div>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-mediterranean">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--mediterranean-blue)]" />
              Productividad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Completadas esta semana</p>
                <p className="text-xs text-muted-foreground">vs semana anterior</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{stats?.completedThisWeek || 0}</span>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Completadas este mes</p>
                <p className="text-xs text-muted-foreground">vs mes anterior</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{stats?.completedThisMonth || 0}</span>
                {stats && stats.completedThisMonth >= (stats.completedLastMonth || 0) ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--mediterranean-terracotta)]"></div>
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
