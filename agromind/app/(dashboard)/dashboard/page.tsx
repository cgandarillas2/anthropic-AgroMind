import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectRisks } from "@/lib/weather/indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, BellRing, Leaf, DollarSign, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { PHENOLOGICAL_STAGE_LABELS, DESTINATION_LABELS } from "@/types";
import { getWeatherInfo } from "@/lib/weather/open-meteo";

export const revalidate = 900; // 15 min

async function getDashboardData(clerkId: string) {
  try {
  // In dev mode: if the user has no farms, reassign the seed farm
  const userCheck = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (userCheck) {
    const hasFarm = await db.farm.findFirst({ where: { ownerId: userCheck.id } });
    if (!hasFarm) {
      // Reassign the test farm to this user
      await db.farm.updateMany({
        where: { id: "farm_curico_001" },
        data: { ownerId: userCheck.id },
      }).catch(() => null); // silent if already reassigned
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

  const activeCycles = farm.lots
    .flatMap((l) =>
      l.crops.flatMap((c) =>
        c.productionCycles.map((cy) => ({
          ...cy,
          variety: c.variety,
          lotName: l.name,
          lotArea: l.area,
        }))
      )
    )
    .filter((cy) => cy.isActive);

  const totalCosts = activeCycles.reduce(
    (acc, cy) => {
      const inputsCost = cy.inputs.reduce((s, i) => s + i.totalCost, 0);
      const laborCost = cy.laborRecords.reduce((s, l) => s + l.totalCost, 0);
      return {
        inputs: acc.inputs + inputsCost,
        labor: acc.labor + laborCost,
        total: acc.total + inputsCost + laborCost,
        area: acc.area + cy.lotArea,
      };
    },
    { inputs: 0, labor: 0, total: 0, area: 0 }
  );

  let weatherSummary = null;
  try {
    const w = await fetchWeather(farm.latitude, farm.longitude);
    const risks = detectRisks(
      w.forecast,
      activeCycles[0]?.phenologicalStage ?? "FRUIT_SET",
      activeCycles[0]?.chillHoursAccumulated ?? 0,
      w.current.humidity
    );
    weatherSummary = {
      tempC: w.current.tempC,
      weatherCode: w.current.weatherCode,
      criticalRisks: risks.filter((r) => r.severity === "CRITICAL").length,
    };
  } catch {
    // Weather unavailable — don't block dashboard
  }

  return { user, farm, activeCycles, totalCosts, weatherSummary };
  } catch (e) {
    console.error("[DASHBOARD_DATA]", e);
    return null;
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getDashboardData(userId);

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">You have no farms registered.</p>
        <Link href="/farms/new" className="text-green-600 underline">
          Register my first farm
        </Link>
      </div>
    );
  }

  const { user, farm, activeCycles, totalCosts, weatherSummary } = data;
  const cycleRef = activeCycles[0];
  const today = format(new Date(), "EEEE, MMMM d", { locale: enUS });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 capitalize mt-0.5">{today}</p>
      </div>

      {/* Unread alerts */}
      {farm.alerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <BellRing className="w-4 h-4 text-red-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-red-800 text-sm">
              You have <strong>{farm.alerts.length} alert(s)</strong> unread
            </span>
            <Link href="/alerts" className="text-red-600 text-sm font-medium underline underline-offset-2">
              View all →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/weather">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Temperature</CardTitle>
              <Thermometer className="w-4 h-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {weatherSummary ? `${Math.round(weatherSummary.tempC)}°C` : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {weatherSummary && <span>{getWeatherInfo(weatherSummary.weatherCode).emoji}</span>}
                {weatherSummary?.criticalRisks
                  ? <span className="text-red-500">{weatherSummary.criticalRisks} critical risk(s)</span>
                  : <span>No weather alerts</span>}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cycles">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Phenology</CardTitle>
              <Leaf className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-base font-bold leading-tight">
                {cycleRef ? PHENOLOGICAL_STAGE_LABELS[cycleRef.phenologicalStage] : "—"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {cycleRef ? `❄️ ${cycleRef.chillHoursAccumulated}h cold` : "No active cycle"}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/inputs">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Accumulated cost</CardTitle>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(totalCosts.total / 1_000_000).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ${Math.round(totalCosts.total / Math.max(totalCosts.area, 1) / 1000)}k/ha
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cycles">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-gray-500">Estimated harvest</CardTitle>
              <Calendar className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              {cycleRef?.estimatedHarvestDate ? (
                <>
                  <div className="text-base font-bold">
                    {format(cycleRef.estimatedHarvestDate, "MMM d", { locale: enUS })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    in {differenceInDays(cycleRef.estimatedHarvestDate, new Date())} days
                  </div>
                </>
              ) : (
                <div className="text-base font-bold text-gray-400">To be defined</div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Active cycles */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Active cycles — {farm.name}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCycles.map((cycle) => {
            const inputsCost = cycle.inputs.reduce((s, i) => s + i.totalCost, 0);
            const laborCost = cycle.laborRecords.reduce((s, l) => s + l.totalCost, 0);
            const totalCost = inputsCost + laborCost;
            const estimatedIncome = cycle.estimatedYield
              ? cycle.estimatedYield * cycle.lotArea * 1200
              : null;

            return (
              <Card key={cycle.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{cycle.lotName}</CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cycle.variety} · {cycle.lotArea} ha · {cycle.season}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                      {DESTINATION_LABELS[cycle.productionDestination]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Est. size</div>
                      <div className="font-bold text-sm">{cycle.estimatedCalibration?.toFixed(1) ?? "—"}mm</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Est. yield</div>
                      <div className="font-bold text-sm">
                        {cycle.estimatedYield ? `${(cycle.estimatedYield / 1000).toFixed(1)}t/ha` : "—"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Cold hours</div>
                      <div className={`font-bold text-sm ${cycle.chillHoursAccumulated >= 800 ? "text-green-600" : "text-yellow-600"}`}>
                        {cycle.chillHoursAccumulated}h
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Inputs</span>
                      <span>${(inputsCost / 1000).toFixed(0)}k CLP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span>${(laborCost / 1000).toFixed(0)}k CLP</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total</span>
                      <span>${(totalCost / 1_000_000).toFixed(3)}M CLP</span>
                    </div>
                    {estimatedIncome && (
                      <div className="flex justify-between text-green-600 font-medium">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Est. income
                        </span>
                        <span>${(estimatedIncome / 1_000_000).toFixed(2)}M CLP</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent alerts */}
      {farm.alerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent alerts</h2>
            <Link href="/alerts" className="text-xs text-green-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {farm.alerts.map((alert) => {
              const styles = {
                CRITICAL: "border-red-200 bg-red-50",
                WARNING:  "border-yellow-200 bg-yellow-50",
                INFO:     "border-blue-200 bg-blue-50",
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
