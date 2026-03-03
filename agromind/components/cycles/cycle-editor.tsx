"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Save, Leaf, Snowflake, Scale, Calendar, TrendingUp } from "lucide-react";
import type { ProductionCycle, Crop, Lot, Input as InputRecord, LaborRecord } from "@prisma/client";
import { ESTADO_FENOLOGICO_LABELS, DESTINO_LABELS } from "@/types";
import { UMBRALES, getHorasFrioPct } from "@/lib/weather/indicators";
import { cn } from "@/lib/utils";

type FullCycle = ProductionCycle & {
  crop: Crop & { lot: Lot };
  inputs: InputRecord[];
  laborRecords: LaborRecord[];
};

interface Props { cycle: FullCycle; }

const FENOLOGIA_ORDER = [
  "DORMANCIA","BROTAMIENTO","FLORACION","CUAJA",
  "CRECIMIENTO_FRUTO","LLENADO_FRUTO","MADUREZ","POSTCOSECHA",
] as const;

export function CycleEditor({ cycle: initial }: Props) {
  const [cycle, setCycle] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

  function update<K extends keyof typeof cycle>(key: K, value: (typeof cycle)[K]) {
    setCycle((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cycle.id,
          estadoFenologico: cycle.estadoFenologico,
          horasFrioAcumuladas: cycle.horasFrioAcumuladas,
          calibreEstimado: cycle.calibreEstimado,
          rendimientoEstimado: cycle.rendimientoEstimado,
          fechaCosechaEstimada: cycle.fechaCosechaEstimada
            ? new Date(cycle.fechaCosechaEstimada).toISOString().split("T")[0]
            : null,
          destinoProduccion: cycle.destinoProduccion,
          notas: cycle.notas,
        }),
      });
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const totalInsumos = cycle.inputs.reduce((s, i) => s + i.totalCost, 0);
  const totalLabor = cycle.laborRecords.reduce((s, l) => s + l.totalCost, 0);
  const totalCost = totalInsumos + totalLabor;
  const horasPct = getHorasFrioPct(cycle.horasFrioAcumuladas);
  const ingresosEst = cycle.rendimientoEstimado
    ? cycle.rendimientoEstimado * cycle.crop.lot.area * 1200
    : null;

  // Paso de fenología actual en la progresión
  const fenologiaIdx = FENOLOGIA_ORDER.indexOf(cycle.estadoFenologico as typeof FENOLOGIA_ORDER[number]);

  return (
    <div className="space-y-5">
      {/* Header del ciclo */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {cycle.crop.variety} · {cycle.crop.lot.name}
            </h2>
            <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
              {DESTINO_LABELS[cycle.destinoProduccion]}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Season {cycle.season} · {cycle.crop.lot.area} ha · Rootstock {cycle.crop.rootstock ?? "—"}
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving..." : "Save changes"}
          </Button>
        )}
      </div>

      {/* Progresión fenológica visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-500" /> Phenological stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {FENOLOGIA_ORDER.map((estado, i) => {
              const isActive = estado === cycle.estadoFenologico;
              const isPast = i < fenologiaIdx;
              return (
                <button
                  key={estado}
                  onClick={() => update("estadoFenologico", estado)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors shrink-0",
                    isActive ? "bg-green-600 text-white font-semibold" :
                    isPast ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  )}
                >
                  <span>{["🌙","🌿","🌸","🍒","⚪","🔴","✂️","🍂"][i]}</span>
                  <span className="leading-tight text-center" style={{ fontSize: "10px" }}>
                    {ESTADO_FENOLOGICO_LABELS[estado].split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Current: <strong className="text-gray-700">{ESTADO_FENOLOGICO_LABELS[cycle.estadoFenologico]}</strong>
            {" · "}Click a stage to update
          </p>
        </CardContent>
      </Card>

      {/* Métricas editables + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Horas frío */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-blue-400" /> Accumulated chill hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  value={cycle.horasFrioAcumuladas}
                  onChange={(e) => update("horasFrioAcumuladas", Number(e.target.value))}
                  className="text-2xl font-bold h-12 text-center"
                />
              </div>
              <span className="text-gray-400 text-sm pb-2">/ {UMBRALES.HORAS_FRIO_META}h target</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={cn("h-2.5 rounded-full transition-all",
                  horasPct >= 100 ? "bg-green-500" : horasPct >= 87 ? "bg-yellow-400" : "bg-red-400"
                )}
                style={{ width: `${horasPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {horasPct}% · {cycle.horasFrioAcumuladas >= UMBRALES.HORAS_FRIO_META
                ? "✅ Target met"
                : `Missing ${UMBRALES.HORAS_FRIO_META - cycle.horasFrioAcumuladas}h`}
            </p>
          </CardContent>
        </Card>

        {/* Estimaciones de cosecha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" /> Harvest estimates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400">Estimated caliber (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="mt-1 h-8 text-sm"
                  value={cycle.calibreEstimado ?? ""}
                  onChange={(e) => update("calibreEstimado", e.target.value ? Number(e.target.value) : null)}
                  placeholder="28.0"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Est. yield (kg/ha)</Label>
                <Input
                  type="number"
                  className="mt-1 h-8 text-sm"
                  value={cycle.rendimientoEstimado ?? ""}
                  onChange={(e) => update("rendimientoEstimado", e.target.value ? Number(e.target.value) : null)}
                  placeholder="12000"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Estimated harvest date
              </Label>
              <Input
                type="date"
                className="mt-1 h-8 text-sm"
                value={cycle.fechaCosechaEstimada
                  ? new Date(cycle.fechaCosechaEstimada).toISOString().split("T")[0]
                  : ""}
                onChange={(e) => update("fechaCosechaEstimada", e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Production destination</Label>
              <Select
                value={cycle.destinoProduccion}
                onValueChange={(v) => update("destinoProduccion", v as typeof cycle.destinoProduccion)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DESTINO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen financiero */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Cycle financial summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400">Inputs</div>
              <div className="font-bold text-gray-800">${(totalInsumos / 1_000_000).toFixed(3)}M</div>
              <div className="text-xs text-gray-400">{cycle.inputs.length} rec.</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Labor</div>
              <div className="font-bold text-gray-800">${(totalLabor / 1_000_000).toFixed(3)}M</div>
              <div className="text-xs text-gray-400">{cycle.laborRecords.length} workdays</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Total cost</div>
              <div className="font-bold text-gray-900 text-lg">${(totalCost / 1_000_000).toFixed(3)}M</div>
              <div className="text-xs text-gray-400">
                ${Math.round(totalCost / cycle.crop.lot.area / 1000)}k/ha
              </div>
            </div>
            {ingresosEst && (
              <div>
                <div className="text-xs text-gray-400">Estimated income</div>
                <div className="font-bold text-green-600 text-lg">${(ingresosEst / 1_000_000).toFixed(2)}M</div>
                <div className="text-xs text-green-500">
                  Margin: ${((ingresosEst - totalCost) / 1_000_000).toFixed(2)}M
                </div>
              </div>
            )}
          </div>

          {cycle.notas && (
            <>
              <Separator className="my-3" />
              <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Notes: </span>{cycle.notas}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
