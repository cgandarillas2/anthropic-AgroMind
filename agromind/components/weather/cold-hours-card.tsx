import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UMBRALES, getHorasFrioColor, getHorasFrioPct } from "@/lib/weather/indicators";
import { ESTADO_FENOLOGICO_LABELS } from "@/types";
import type { EstadoFenologico } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Props {
  horasAcumuladas: number;
  estadoFenologico: EstadoFenologico;
  variedad: string;
}

export function ColdHoursCard({ horasAcumuladas, estadoFenologico, variedad }: Props) {
  const pct = getHorasFrioPct(horasAcumuladas);
  const color = getHorasFrioColor(horasAcumuladas);
  const metaCumplida = horasAcumuladas >= UMBRALES.HORAS_FRIO_META;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
          <span>❄️ Horas frío acumuladas</span>
          <span className="text-xs font-normal text-gray-400">{variedad}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className={cn("text-3xl font-bold", color)}>
            {horasAcumuladas}h
          </span>
          <span className="text-sm text-gray-400">
            meta: {UMBRALES.HORAS_FRIO_META}h
          </span>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              "h-3 rounded-full transition-all",
              metaCumplida
                ? "bg-green-500"
                : pct >= 87.5
                ? "bg-yellow-400"
                : "bg-red-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{pct}% completado</span>
          {!metaCumplida && (
            <span className="text-amber-600 font-medium">
              Faltan {UMBRALES.HORAS_FRIO_META - horasAcumuladas}h
            </span>
          )}
          {metaCumplida && (
            <span className="text-green-600 font-medium">✓ Meta cumplida</span>
          )}
        </div>

        <div className="text-xs text-gray-400 border-t pt-2">
          Estado: {ESTADO_FENOLOGICO_LABELS[estadoFenologico]}
        </div>
      </CardContent>
    </Card>
  );
}
