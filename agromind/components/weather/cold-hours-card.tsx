import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UMBRALES, getChillHoursColor, getChillHoursPct } from "@/lib/weather/indicators";
import { PHENOLOGICAL_STAGE_LABELS } from "@/types";
import type { PhenologicalStage } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Props {
  horasAcumuladas: number;
  phenologicalStage: PhenologicalStage;
  variedad: string;
}

export function ColdHoursCard({ horasAcumuladas, phenologicalStage, variedad }: Props) {
  const pct = getChillHoursPct(horasAcumuladas);
  const color = getChillHoursColor(horasAcumuladas);
  const targetMet = horasAcumuladas >= UMBRALES.HORAS_FRIO_META;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
          <span>❄️ Accumulated chill hours</span>
          <span className="text-xs font-normal text-gray-400">{variedad}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className={cn("text-3xl font-bold", color)}>
            {horasAcumuladas}h
          </span>
          <span className="text-sm text-gray-400">
            target: {UMBRALES.HORAS_FRIO_META}h
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              "h-3 rounded-full transition-all",
              targetMet
                ? "bg-green-500"
                : pct >= 87.5
                ? "bg-yellow-400"
                : "bg-red-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{pct}% completed</span>
          {!targetMet && (
            <span className="text-amber-600 font-medium">
              Missing {UMBRALES.HORAS_FRIO_META - horasAcumuladas}h
            </span>
          )}
          {targetMet && (
            <span className="text-green-600 font-medium">✓ Target met</span>
          )}
        </div>

        <div className="text-xs text-gray-400 border-t pt-2">
          Stage: {PHENOLOGICAL_STAGE_LABELS[phenologicalStage]}
        </div>
      </CardContent>
    </Card>
  );
}
