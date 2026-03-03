import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos } from "@/lib/weather/indicators";
import { CurrentWeatherCard } from "@/components/weather/current-weather-card";
import { ForecastStrip } from "@/components/weather/forecast-strip";
import { RiskBanners } from "@/components/weather/risk-banners";
import { ColdHoursCard } from "@/components/weather/cold-hours-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

export const revalidate = 1800; // revalidate every 30 min

async function getWeatherData(clerkId: string) {
  const farm = await db.farm.findFirst({
    where: { owner: { clerkId } },
    include: {
      lots: {
        include: {
          crops: {
            include: {
              productionCycles: {
                where: { isActive: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      weatherLogs: {
        orderBy: { timestamp: "desc" },
        take: 7,
      },
    },
  });

  if (!farm) return null;

  const weather = await fetchWeather(farm.latitude, farm.longitude);

  const ciclosActivos = farm.lots
    .flatMap((l) => l.crops)
    .flatMap((c) =>
      c.productionCycles.map((cy) => ({ ...cy, variedad: c.variety }))
    )
    .filter((cy) => cy.isActive);

  const cicloRef = ciclosActivos[0];

  const riesgos = detectarRiesgos(
    weather.forecast,
    cicloRef?.estadoFenologico ?? "CUAJA",
    cicloRef?.horasFrioAcumuladas ?? 0,
    weather.current.humidity
  );

  return { farm, weather, ciclosActivos, riesgos };
}

export default async function WeatherPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getWeatherData(userId);

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        No farm registered.{" "}
        <a href="/farms/new" className="text-green-600 underline">
          Create farm
        </a>
      </div>
    );
  }

  const { farm, weather, ciclosActivos, riesgos } = data;
  const ahora = format(new Date(), "MMMM d, HH:mm'h'", { locale: enUS });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weather</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {farm.commune}, {farm.region} · Updated {ahora}
          </p>
        </div>
        <div className="text-xs text-gray-400 text-right">
          <div>{farm.latitude.toFixed(4)}°S</div>
          <div>{Math.abs(farm.longitude).toFixed(4)}°O</div>
        </div>
      </div>

      {/* Risk alerts — critical ones go first */}
      {riesgos.some((r) => r.severidad === "CRITICA") && (
        <RiskBanners riesgos={riesgos.filter((r) => r.severidad === "CRITICA")} />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current weather — takes 2 columns */}
        <div className="md:col-span-2">
          <CurrentWeatherCard
            weather={weather.current}
            farmName={farm.name}
            commune={farm.commune}
          />
        </div>

        {/* Cold hours per cycle */}
        <div className="space-y-3">
          {ciclosActivos.slice(0, 2).map((ciclo) => (
            <ColdHoursCard
              key={ciclo.id}
              horasAcumuladas={ciclo.horasFrioAcumuladas}
              estadoFenologico={ciclo.estadoFenologico}
              variedad={ciclo.variedad}
            />
          ))}
        </div>
      </div>

      {/* 7-day forecast */}
      <ForecastStrip forecast={weather.forecast} />

      {/* Warning/info alerts */}
      {riesgos.filter((r) => r.severidad !== "CRITICA").length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Alerts and recommendations
          </h2>
          <RiskBanners riesgos={riesgos.filter((r) => r.severidad !== "CRITICA")} />
        </div>
      )}

      {/* No risks */}
      {riesgos.length === 0 && (
        <RiskBanners riesgos={[]} />
      )}

      {/* Recent weather history */}
      {farm.weatherLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Last 7 days history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left pb-2">Date</th>
                    <th className="text-right pb-2">Avg T°</th>
                    <th className="text-right pb-2">Min T°</th>
                    <th className="text-right pb-2">Max T°</th>
                    <th className="text-right pb-2">Rain</th>
                    <th className="text-right pb-2">RH%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {farm.weatherLogs.map((log) => (
                    <tr key={log.id} className="text-gray-700">
                      <td className="py-1.5 text-gray-500 text-xs">
                        {format(log.timestamp, "MMM dd", { locale: enUS })}
                      </td>
                      <td className="text-right font-medium">{log.tempC.toFixed(1)}°</td>
                      <td className="text-right text-blue-600">
                        {log.tempMinC?.toFixed(1) ?? "—"}°
                      </td>
                      <td className={`text-right ${(log.tempMaxC ?? 0) > 35 ? "text-red-500 font-semibold" : "text-orange-500"}`}>
                        {log.tempMaxC?.toFixed(1) ?? "—"}°
                      </td>
                      <td className={`text-right ${log.precipMm > 1 ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                        {log.precipMm > 0 ? `${log.precipMm.toFixed(1)}mm` : "—"}
                      </td>
                      <td className="text-right text-gray-500">
                        {log.humidity?.toFixed(0) ?? "—"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
