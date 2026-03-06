import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getWeatherInfo, type ForecastDay } from "@/lib/weather/open-meteo";
import { formatShortDate } from "@/lib/weather/indicators";

interface Props {
  forecast: ForecastDay[];
}

export function ForecastStrip({ forecast }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">
          7-day forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {forecast.slice(0, 7).map((day) => {
            const { emoji } = getWeatherInfo(day.weatherCode);
            const hasRisk = day.riesgoHelada || day.riesgoLluvia || day.riesgoCalor;

            return (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg text-center",
                  hasRisk ? "bg-orange-50 border border-orange-200" : "bg-gray-50"
                )}
              >
                <span className="text-xs text-gray-500 font-medium leading-tight">
                  {formatShortDate(day.date)}
                </span>
                <span className="text-2xl">{emoji}</span>
                <div className="text-xs font-bold text-gray-800">
                  {Math.round(day.tempMaxC)}°
                </div>
                <div className="text-xs text-gray-400">
                  {Math.round(day.tempMinC)}°
                </div>
                {day.precipMm > 0.1 && (
                  <div className="text-xs text-blue-500 font-medium">
                    {day.precipMm.toFixed(1)}mm
                  </div>
                )}
                {/* Indicadores de riesgo */}
                <div className="flex gap-0.5 flex-wrap justify-center">
                  {day.riesgoHelada && (
                    <span title="Frost risk" className="text-[10px]">🧊</span>
                  )}
                  {day.riesgoLluvia && (
                    <span title="Harvest rain risk" className="text-[10px]">⚠️</span>
                  )}
                  {day.riesgoCalor && (
                    <span title="Heat stress" className="text-[10px]">🌡️</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ET₀ resumen */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>7-day accumulated ET₀</span>
            <span className="font-semibold text-gray-700">
              {forecast.slice(0, 7).reduce((s, d) => s + d.etMm, 0).toFixed(1)} mm
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
