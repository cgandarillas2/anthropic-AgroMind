import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Layers, Leaf, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ESTADO_FENOLOGICO_LABELS, SEVERITY_COLOR } from "@/types";

async function getFarm(farmId: string, clerkId: string) {
  return db.farm.findFirst({
    where: { id: farmId, owner: { clerkId } },
    include: {
      lots: {
        include: {
          crops: {
            include: {
              productionCycles: {
                where: { isActive: true },
                include: {
                  inputs: { orderBy: { date: "desc" }, take: 3 },
                  laborRecords: { orderBy: { date: "desc" }, take: 3 },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
      alerts: {
        where: { resolvedAt: null },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 5,
      },
    },
  });
}

export default async function FarmDetailPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { farmId } = await params;
  const farm = await getFarm(farmId, userId);
  if (!farm) notFound();

  const totalLots = farm.lots.length;
  const totalCrops = farm.lots.reduce((s, l) => s + l.crops.length, 0);
  const activeCycles = farm.lots.flatMap((l) =>
    l.crops.flatMap((c) => c.productionCycles)
  );

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <Link
          href="/farms"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> All Farms
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{farm.name}</h1>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-4 w-4" />
          {farm.address} · {farm.commune}, {farm.region}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Area</p>
            <p className="text-xl font-bold text-gray-900">{farm.totalArea} ha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Lots</p>
            <p className="text-xl font-bold text-gray-900">{totalLots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Crops</p>
            <p className="text-xl font-bold text-gray-900">{totalCrops}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500">Active Cycles</p>
            <p className="text-xl font-bold text-green-600">{activeCycles.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Coordinates */}
      <p className="text-xs text-gray-400">
        Coordinates: {farm.latitude.toFixed(6)}, {farm.longitude.toFixed(6)}
      </p>

      {/* Active alerts */}
      {farm.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Active Alerts
          </h2>
          <div className="space-y-2">
            {farm.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_COLOR[alert.severity]}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs mt-0.5 opacity-80">{alert.description}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {alert.severity}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lots */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-500" />
          Lots and Crops
        </h2>
        {farm.lots.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-gray-400">
              No lots registered for this farm.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {farm.lots.map((lot) => (
              <Card key={lot.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    {lot.name}
                    <span className="text-xs font-normal text-gray-500">
                      {lot.area} ha
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lot.crops.length === 0 ? (
                    <p className="text-xs text-gray-400">No crops</p>
                  ) : (
                    lot.crops.map((crop) => (
                      <div key={crop.id} className="border rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Leaf className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-sm font-medium">{crop.variety}</span>
                          <span className="text-xs text-gray-400">/ {crop.rootstock}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Planted: {crop.plantYear} · {crop.density} plants/ha
                        </p>
                        {crop.productionCycles.map((cycle) => (
                          <div
                            key={cycle.id}
                            className="bg-green-50 rounded p-1.5 text-xs text-green-800"
                          >
                            <span className="font-medium">
                              {ESTADO_FENOLOGICO_LABELS[cycle.estadoFenologico]}
                            </span>
                            {cycle.horasFrioAcumuladas != null && (
                              <span className="ml-2 text-green-600">
                                · {cycle.horasFrioAcumuladas}h chill
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
