import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos } from "@/lib/weather/indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, BellRing, Leaf, DollarSign, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { ESTADO_FENOLOGICO_LABELS, DESTINO_LABELS } from "@/types";
import { getWeatherInfo } from "@/lib/weather/open-meteo";

export const revalidate = 900; // 15 min

async function getDashboardData(clerkId: string) {
  // En dev local: si el usuario no tiene farms, reasignar el farm del seed
  const userCheck = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (userCheck) {
    const hasFarm = await db.farm.findFirst({ where: { ownerId: userCheck.id } });
    if (!hasFarm) {
      // Reasignar el farm de prueba a este usuario
      await db.farm.updateMany({
        where: { id: "farm_curico_001" },
        data: { ownerId: userCheck.id },
      }).catch(() => null); // silencioso si ya fue reasignado
    }
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    include: {
      farms: {
        include: {
          lots: {
            include: {
              crops: {
                include: {
                  productionCycles: {
                    where: { isActive: true },
                    include: { inputs: true, laborRecords: true },
                    take: 1,
                  },
                },
              },
            },
          },
          alerts: {
            where: { isRead: false, isResolved: false },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        take: 1,
      },
    },
  });

  if (!user || user.farms.length === 0) return null;

  const farm = user.farms[0];

  const ciclosActivos = farm.lots
    .flatMap((l) =>
      l.crops.flatMap((c) =>
        c.productionCycles.map((cy) => ({
          ...cy,
          variedad: c.variety,
          loteNombre: l.name,
          loteArea: l.area,
        }))
      )
    )
    .filter((cy) => cy.isActive);

  const costosTotales = ciclosActivos.reduce(
    (acc, cy) => {
      const costoInsumos = cy.inputs.reduce((s, i) => s + i.totalCost, 0);
      const costoLabor = cy.laborRecords.reduce((s, l) => s + l.totalCost, 0);
      return {
        insumos: acc.insumos + costoInsumos,
        labor: acc.labor + costoLabor,
        total: acc.total + costoInsumos + costoLabor,
        area: acc.area + cy.loteArea,
      };
    },
    { insumos: 0, labor: 0, total: 0, area: 0 }
  );

  let weatherSummary = null;
  try {
    const w = await fetchWeather(farm.latitude, farm.longitude);
    const riesgos = detectarRiesgos(
      w.forecast,
      ciclosActivos[0]?.estadoFenologico ?? "CUAJA",
      ciclosActivos[0]?.horasFrioAcumuladas ?? 0,
      w.current.humidity
    );
    weatherSummary = {
      tempC: w.current.tempC,
      weatherCode: w.current.weatherCode,
      riesgosCriticos: riesgos.filter((r) => r.severidad === "CRITICA").length,
    };
  } catch {
    // Clima no disponible — no bloquear dashboard
  }

  return { user, farm, ciclosActivos, costosTotales, weatherSummary };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getDashboardData(userId);

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No tienes predios registrados.</p>
        <Link href="/farms/new" className="text-green-600 underline">
          Registrar mi primer predio
        </Link>
      </div>
    );
  }

  const { user, farm, ciclosActivos, costosTotales, weatherSummary } = data;
  const cicloRef = ciclosActivos[0];
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 capitalize mt-0.5">{hoy}</p>
      </div>

      {/* Alertas no leídas */}
      {farm.alerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <BellRing className="w-4 h-4 text-red-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-red-800 text-sm">
              Tienes <strong>{farm.alerts.length} alerta(s)</strong> sin leer
            </span>
            <Link href="/alerts" className="text-red-600 text-sm font-medium underline underline-offset-2">
              Ver todas →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/weather">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Temperatura</CardTitle>
              <Thermometer className="w-4 h-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {weatherSummary ? `${Math.round(weatherSummary.tempC)}°C` : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {weatherSummary && <span>{getWeatherInfo(weatherSummary.weatherCode).emoji}</span>}
                {weatherSummary?.riesgosCriticos
                  ? <span className="text-red-500">{weatherSummary.riesgosCriticos} riesgo(s) crítico(s)</span>
                  : <span>Sin alertas climáticas</span>}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cycles">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Fenología</CardTitle>
              <Leaf className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-base font-bold leading-tight">
                {cicloRef ? ESTADO_FENOLOGICO_LABELS[cicloRef.estadoFenologico] : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {cicloRef ? `❄️ ${cicloRef.horasFrioAcumuladas}h frío` : "Sin ciclo activo"}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/inputs">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Costo acumulado</CardTitle>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(costosTotales.total / 1_000_000).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ${Math.round(costosTotales.total / Math.max(costosTotales.area, 1) / 1000)}k/ha
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cycles">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Cosecha estimada</CardTitle>
              <Calendar className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              {cicloRef?.fechaCosechaEstimada ? (
                <>
                  <div className="text-base font-bold">
                    {format(cicloRef.fechaCosechaEstimada, "d MMM", { locale: es })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    en {differenceInDays(cicloRef.fechaCosechaEstimada, new Date())} días
                  </div>
                </>
              ) : (
                <div className="text-base font-bold text-gray-400">Por definir</div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Ciclos activos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Ciclos activos — {farm.name}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ciclosActivos.map((ciclo) => {
            const costoInsumos = ciclo.inputs.reduce((s, i) => s + i.totalCost, 0);
            const costoLabor = ciclo.laborRecords.reduce((s, l) => s + l.totalCost, 0);
            const costoTotal = costoInsumos + costoLabor;
            const ingresosEst = ciclo.rendimientoEstimado
              ? ciclo.rendimientoEstimado * ciclo.loteArea * 1200
              : null;

            return (
              <Card key={ciclo.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{ciclo.loteNombre}</CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ciclo.variedad} · {ciclo.loteArea} ha · {ciclo.season}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                      {DESTINO_LABELS[ciclo.destinoProduccion]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Calibre est.</div>
                      <div className="font-bold text-sm">{ciclo.calibreEstimado?.toFixed(1) ?? "—"}mm</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Rend. est.</div>
                      <div className="font-bold text-sm">
                        {ciclo.rendimientoEstimado ? `${(ciclo.rendimientoEstimado / 1000).toFixed(1)}t/ha` : "—"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Horas frío</div>
                      <div className={`font-bold text-sm ${ciclo.horasFrioAcumuladas >= 800 ? "text-green-600" : "text-yellow-600"}`}>
                        {ciclo.horasFrioAcumuladas}h
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Insumos</span>
                      <span>${(costoInsumos / 1000).toFixed(0)}k CLP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mano de obra</span>
                      <span>${(costoLabor / 1000).toFixed(0)}k CLP</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total</span>
                      <span>${(costoTotal / 1_000_000).toFixed(3)}M CLP</span>
                    </div>
                    {ingresosEst && (
                      <div className="flex justify-between text-green-600 font-medium">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Ingreso est.
                        </span>
                        <span>${(ingresosEst / 1_000_000).toFixed(2)}M CLP</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Alertas recientes */}
      {farm.alerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Alertas recientes</h2>
            <Link href="/alerts" className="text-xs text-green-600 hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {farm.alerts.map((alert) => {
              const styles = {
                CRITICA:    "border-red-200 bg-red-50",
                ADVERTENCIA:"border-yellow-200 bg-yellow-50",
                INFO:       "border-blue-200 bg-blue-50",
              };
              return (
                <div key={alert.id} className={`rounded-lg border px-4 py-3 ${styles[alert.severity]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{alert.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">
                      {alert.severity.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
