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
import { PHENOLOGICAL_STAGE_LABELS, DESTINATION_LABELS } from "@/types";
import { UMBRALES, getChillHoursPct } from "@/lib/weather/indicators";
import { cn } from "@/lib/utils";

type FullCycle = ProductionCycle & {
  crop: Crop & { lot: Lot };
  inputs: InputRecord[];
  laborRecords: LaborRecord[];
};

interface Props { cycle: FullCycle; }

const PHENOLOGY_ORDER = [
  "DORMANCY","BUDBREAK","FLOWERING","FRUIT_SET",
  "FRUIT_GROWTH","FRUIT_FILL","MATURITY","POST_HARVEST",
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
          phenologicalStage: cycle.phenologicalStage,
          chillHoursAccumulated: cycle.chillHoursAccumulated,
          estimatedCalibration: cycle.estimatedCalibration,
          estimatedYield: cycle.estimatedYield,
          estimatedHarvestDate: cycle.estimatedHarvestDate
            ? new Date(cycle.estimatedHarvestDate).toISOString().split("T")[0]
            : null,
          productionDestination: cycle.productionDestination,
          notes: cycle.notes,
        }),
      });
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const totalInputs = cycle.inputs.reduce((s, i) => s + i.totalCost, 0);
  const totalLabor = cycle.laborRecords.reduce((s, l) => s + l.totalCost, 0);
  const totalCost = totalInputs + totalLabor;
  const chillPct = getChillHoursPct(cycle.chillHoursAccumulated);
  const estimatedIncome = cycle.estimatedYield
    ? cycle.estimatedYield * cycle.crop.lot.area * 1200
    : null;

  // Current phenology step in the progression
  const phenologyIdx = PHENOLOGY_ORDER.indexOf(cycle.phenologicalStage as typeof PHENOLOGY_ORDER[number]);

  return (
    <div className="space-y-5">
      {/* Cycle header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {cycle.crop.variety} · {cycle.crop.lot.name}
            </h2>
            <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
              {DESTINATION_LABELS[cycle.productionDestination]}
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

      {/* Visual phenological progression */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-500" /> Phenological stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PHENOLOGY_ORDER.map((stage, i) => {
              const isActive = stage === cycle.phenologicalStage;
              const isPast = i < phenologyIdx;
              return (
                <button
                  key={stage}
                  onClick={() => update("phenologicalStage", stage)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors shrink-0",
                    isActive ? "bg-green-600 text-white font-semibold" :
                    isPast ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  )}
                >
                  <span>{["🌙","🌿","🌸","🍒","⚪","🔴","✂️","🍂"][i]}</span>
                  <span className="leading-tight text-center" style={{ fontSize: "10px" }}>
                    {PHENOLOGICAL_STAGE_LABELS[stage].split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Current: <strong className="text-gray-700">{PHENOLOGICAL_STAGE_LABELS[cycle.phenologicalStage]}</strong>
            {" · "}Click a stage to update
          </p>
        </CardContent>
      </Card>

      {/* Editable metrics + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chill hours */}
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
                  value={cycle.chillHoursAccumulated}
                  onChange={(e) => update("chillHoursAccumulated", Number(e.target.value))}
                  className="text-2xl font-bold h-12 text-center"
                />
              </div>
              <span className="text-gray-400 text-sm pb-2">/ {UMBRALES.HORAS_FRIO_META}h target</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={cn("h-2.5 rounded-full transition-all",
                  chillPct >= 100 ? "bg-green-500" : chillPct >= 87 ? "bg-yellow-400" : "bg-red-400"
                )}
                style={{ width: `${chillPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {chillPct}% · {cycle.chillHoursAccumulated >= UMBRALES.HORAS_FRIO_META
                ? "✅ Target met"
                : `Missing ${UMBRALES.HORAS_FRIO_META - cycle.chillHoursAccumulated}h`}
            </p>
          </CardContent>
        </Card>

        {/* Harvest estimates */}
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
                  value={cycle.estimatedCalibration ?? ""}
                  onChange={(e) => update("estimatedCalibration", e.target.value ? Number(e.target.value) : null)}
                  placeholder="28.0"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Est. yield (kg/ha)</Label>
                <Input
                  type="number"
                  className="mt-1 h-8 text-sm"
                  value={cycle.estimatedYield ?? ""}
                  onChange={(e) => update("estimatedYield", e.target.value ? Number(e.target.value) : null)}
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
                value={cycle.estimatedHarvestDate
                  ? new Date(cycle.estimatedHarvestDate).toISOString().split("T")[0]
                  : ""}
                onChange={(e) => update("estimatedHarvestDate", e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Production destination</Label>
              <Select
                value={cycle.productionDestination}
                onValueChange={(v) => update("productionDestination", v as typeof cycle.productionDestination)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DESTINATION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial summary */}
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
              <div className="font-bold text-gray-800">${(totalInputs / 1_000_000).toFixed(3)}M</div>
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
            {estimatedIncome && (
              <div>
                <div className="text-xs text-gray-400">Estimated income</div>
                <div className="font-bold text-green-600 text-lg">${(estimatedIncome / 1_000_000).toFixed(2)}M</div>
                <div className="text-xs text-green-500">
                  Margin: ${((estimatedIncome - totalCost) / 1_000_000).toFixed(2)}M
                </div>
              </div>
            )}
          </div>

          {cycle.notes && (
            <>
              <Separator className="my-3" />
              <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Notes: </span>{cycle.notes}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
