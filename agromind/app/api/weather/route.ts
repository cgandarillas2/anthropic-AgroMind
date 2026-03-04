import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos, type RiesgoDetectado } from "@/lib/weather/indicators";
import type { AlertType } from "@prisma/client";

const TRIGGER_METRIC: Record<RiesgoDetectado["tipo"], string> = {
  HELADA:              "temperatura_minima",
  LLUVIA_COSECHA:      "precipitacion_mm",
  GOLPE_CALOR:         "temperatura_maxima",
  VIENTO_FUERTE:       "velocidad_viento_kmh",
  HUMEDAD_ALTA:        "humedad_relativa_pct",
  DEFICIT_HORAS_FRIO:  "horas_frio_acumuladas",
};

/**
 * Persists detected risks as Alert records.
 * Skips if an unresolved alert of the same type was already created today.
 */
async function persistirAlertas(farmId: string, riesgos: RiesgoDetectado[]) {
  if (!riesgos.length) return;

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  // Fetch existing unresolved alerts created today to avoid duplicates
  const existentes = await db.alert.findMany({
    where: {
      farmId,
      isResolved: false,
      createdAt: { gte: hoyInicio },
    },
    select: { type: true },
  });

  const tiposExistentes = new Set(existentes.map((a) => a.type));

  const nuevas = riesgos.filter((r) => !tiposExistentes.has(r.tipo as AlertType));

  if (!nuevas.length) return;

  await db.alert.createMany({
    data: nuevas.map((r) => ({
      farmId,
      type:           r.tipo as AlertType,
      severity:       r.severidad,
      title:          r.titulo,
      description:    r.descripcion,
      recommendation: r.recomendacion,
      triggerValue:   r.valorTrigger,
      triggerMetric:  TRIGGER_METRIC[r.tipo],
      source:         "AUTOMATICA",
    })),
  });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");

  try {
    // Get farm with active cycle
    const farm = await db.farm.findFirst({
      where: farmId ? { id: farmId, owner: { clerkId: userId } } : { owner: { clerkId: userId } },
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
      },
    });

    if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

    // Get weather data from Open-Meteo
    const weatherData = await fetchWeather(farm.latitude, farm.longitude);

    // Extract most recent active cycle
    const cicloActivo = farm.lots
      .flatMap((l) => l.crops)
      .flatMap((c) => c.productionCycles)
      .find((cy) => cy.isActive);

    // Calculate risks for cherry trees
    const riesgos = detectarRiesgos(
      weatherData.forecast,
      cicloActivo?.estadoFenologico ?? "CUAJA",
      cicloActivo?.horasFrioAcumuladas ?? 0,
      weatherData.current.humidity
    );

    // Persist detected risks as alerts (fire-and-forget)
    persistirAlertas(farm.id, riesgos).catch(console.error);

    // Save today's weather log in DB (fire-and-forget)
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    const todayForecast = weatherData.forecast[0];
    if (todayForecast) {
      db.weatherLog
        .upsert({
          where: { farmId_timestamp: { farmId: farm.id, timestamp: hoy } },
          update: {
            tempC: weatherData.current.tempC,
            tempMinC: todayForecast.tempMinC,
            tempMaxC: todayForecast.tempMaxC,
            precipMm: todayForecast.precipMm,
            windSpeedKmh: weatherData.current.windSpeedKmh,
            windDirection: weatherData.current.windDirection,
            humidity: weatherData.current.humidity,
            solarRadiation: weatherData.current.solarRadiation,
            etMm: todayForecast.etMm,
            esBajoUmbralHelada: todayForecast.riesgoHelada,
            esRiesgoLluvia: todayForecast.riesgoLluvia,
            contribuyeHorasFrio: weatherData.current.tempC < 7,
          },
          create: {
            farmId: farm.id,
            timestamp: hoy,
            tempC: weatherData.current.tempC,
            tempMinC: todayForecast.tempMinC,
            tempMaxC: todayForecast.tempMaxC,
            precipMm: todayForecast.precipMm,
            windSpeedKmh: weatherData.current.windSpeedKmh,
            windDirection: weatherData.current.windDirection,
            humidity: weatherData.current.humidity,
            solarRadiation: weatherData.current.solarRadiation,
            etMm: todayForecast.etMm,
            esBajoUmbralHelada: todayForecast.riesgoHelada,
            esRiesgoLluvia: todayForecast.riesgoLluvia,
            contribuyeHorasFrio: weatherData.current.tempC < 7,
          },
        })
        .catch(console.error);
    }

    return NextResponse.json({
      farm: { id: farm.id, name: farm.name, commune: farm.commune, latitude: farm.latitude, longitude: farm.longitude },
      weather: weatherData,
      riesgos,
      cicloActivo: cicloActivo
        ? {
            id: cicloActivo.id,
            estadoFenologico: cicloActivo.estadoFenologico,
            horasFrioAcumuladas: cicloActivo.horasFrioAcumuladas,
            fechaCosechaEstimada: cicloActivo.fechaCosechaEstimada,
          }
        : null,
    });
  } catch (error) {
    console.error("[WEATHER_GET]", error);
    return NextResponse.json({ error: "Error fetching weather" }, { status: 500 });
  }
}
