import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { RiesgoDetectado } from "@/lib/weather/indicators";
import { formatFechaCorta } from "@/lib/weather/indicators";

const SEVERITY_STYLES = {
  CRITICA:    "border-red-300 bg-red-50 text-red-900",
  ADVERTENCIA:"border-yellow-300 bg-yellow-50 text-yellow-900",
  INFO:       "border-blue-300 bg-blue-50 text-blue-900",
} as const;

const SEVERITY_ICONS = {
  CRITICA:    "🚨",
  ADVERTENCIA:"⚠️",
  INFO:       "ℹ️",
} as const;

interface Props {
  riesgos: RiesgoDetectado[];
}

export function RiskBanners({ riesgos }: Props) {
  if (riesgos.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <AlertTitle className="flex items-center gap-2">
          <span>✅</span> Sin alertas climáticas activas
        </AlertTitle>
        <AlertDescription className="text-green-700 text-sm">
          Las condiciones del pronóstico son favorables para el cultivo.
        </AlertDescription>
      </Alert>
    );
  }

  // Ordenar: CRITICA primero
  const ordenados = [...riesgos].sort((a, b) => {
    const orden = { CRITICA: 0, ADVERTENCIA: 1, INFO: 2 };
    return orden[a.severidad] - orden[b.severidad];
  });

  return (
    <div className="space-y-3">
      {ordenados.map((riesgo, i) => (
        <Alert
          key={i}
          className={cn("border", SEVERITY_STYLES[riesgo.severidad])}
        >
          <AlertTitle className="flex items-center gap-2 font-semibold">
            <span>{SEVERITY_ICONS[riesgo.severidad]}</span>
            {riesgo.titulo}
            {riesgo.fechas.length > 0 && (
              <span className="text-xs font-normal opacity-75 ml-auto">
                {riesgo.fechas.map(formatFechaCorta).join(", ")}
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-1">
            <p className="text-sm opacity-90">{riesgo.descripcion}</p>
            <p className="text-sm font-medium border-t border-current/20 pt-1 mt-1">
              <span className="opacity-60">Acción: </span>
              {riesgo.recomendacion}
            </p>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
