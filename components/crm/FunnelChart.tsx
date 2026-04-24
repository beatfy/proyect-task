"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  position: number;
  dealCount: number;
  totalValue: number;
  probability?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

export function FunnelChart({ stages }: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Sin datos de pipeline</p>
    );
  }

  const maxDeals = Math.max(...stages.map(s => s.dealCount), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const widthPercent = Math.max((stage.dealCount / maxDeals) * 100, 8);
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const conversionRate = prevStage && prevStage.dealCount > 0
          ? Math.round((stage.dealCount / prevStage.dealCount) * 100)
          : null;

        return (
          <div key={stage.id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-sm text-foreground font-medium">{stage.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{stage.dealCount} deals</span>
                <span className="font-medium text-foreground">{formatCurrency(stage.totalValue)}</span>
                {conversionRate !== null && (
                  <span className={`text-xs font-medium ${conversionRate >= 50 ? "text-green-600" : "text-amber-600"}`}>
                    {conversionRate}%
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted/50 rounded h-7 relative overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700 ease-out flex items-center px-3"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: `${stage.color}20`,
                  borderLeft: `3px solid ${stage.color}`,
                }}
              >
                {widthPercent > 20 && (
                  <span className="text-xs font-medium truncate" style={{ color: stage.color }}>
                    {stage.dealCount}
                  </span>
                )}
              </div>
            </div>
            {/* Conversion arrow between stages */}
            {conversionRate !== null && (
              <div className="flex items-center justify-center my-1">
                <span className="text-xs text-muted-foreground">
                  ↓ {conversionRate}% conversión
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface RevenueForecastProps {
  stages: FunnelStage[];
}

export function RevenueForecast({ stages }: RevenueForecastProps) {
  const forecastByStage = stages.map(stage => ({
    ...stage,
    weightedValue: stage.totalValue * (stage.probability || 0) / 100,
  }));

  const totalWeighted = forecastByStage.reduce((sum, s) => sum + s.weightedValue, 0);
  const totalPipeline = stages.reduce((sum, s) => sum + s.totalValue, 0);
  const maxWeighted = Math.max(...forecastByStage.map(s => s.weightedValue), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Revenue Forecast (ponderado)</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalWeighted)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pipeline total</p>
          <p className="text-lg font-semibold text-foreground">{formatCurrency(totalPipeline)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {forecastByStage.map(stage => (
          <div key={stage.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{stage.name}</span>
              <span className="text-xs font-medium text-foreground">{formatCurrency(stage.weightedValue)}</span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${(stage.weightedValue / maxWeighted) * 100}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
