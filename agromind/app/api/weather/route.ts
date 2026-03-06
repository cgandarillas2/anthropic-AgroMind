import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectRisks, type DetectedRisk } from "@/lib/weather/indicators";
import type { AlertType } from "@prisma/client";

const TRIGGER_METRIC: Record<DetectedRisk["type"], string> = {
  FROST:              "min_temperature",
  HARVEST_RAIN:       "precipitation_mm",
  HEAT_WAVE:          "max_temperature",
  STRONG_WIND:        "wind_speed_kmh",
  HIGH_HUMIDITY:      "relative_humidity_pct",
  CHILL_HOUR_DEFICIT: "chill_hours_accumulated",
};

/**
 * Persists detected risks as Alert records.
 * Skips if an unresolved alert of the same type was already created today.
 */
async function persistAlerts(farmId: string, risks: DetectedRisk[]) {
  if (!risks.length) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch existing unresolved alerts created today to avoid duplicates
  const existing = await db.alert.findMany({
    where: {
      farmId,
      isResolved: false,
      createdAt: { gte: todayStart },
    },
    select: { type: true },
  });

  const existingTypes = new Set(existing.map((a) => a.type));

  const newAlerts = risks.filter((r) => !existingTypes.has(r.type as AlertType));

  if (!newAlerts.length) return;

  await db.alert.createMany({
    data: newAlerts.map((r) => ({
      farmId,
      type:           r.type as AlertType,
      severity:       r.severity,
      title:          r.title,
      description:    r.description,
      recommendation: r.recommendation,
      triggerValue:   r.triggerValue,
      triggerMetric:  TRIGGER_METRIC[r.type],
      source:         "AUTOMATIC",
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
    const activeCycle = farm.lots
      .flatMap((l) => l.crops)
      .flatMap((c) => c.productionCycles)
      .find((cy) => cy.isActive);

    // Calculate risks for cherry trees
    const risks = detectRisks(
      weatherData.forecast,
      activeCycle?.phenologicalStage ?? "FRUIT_SET",
      activeCycle?.chillHoursAccumulated ?? 0,
      weatherData.current.humidity
    );

    // Persist detected risks as alerts (fire-and-forget)
    persistAlerts(farm.id, risks).catch(console.error);

    // Save today's weather log in DB (fire-and-forget)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayForecast = weatherData.forecast[0];
    if (todayForecast) {
      db.weatherLog
        .upsert({
          where: { farmId_timestamp: { farmId: farm.id, timestamp: today } },
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
            isBelowFrostThreshold: todayForecast.riesgoHelada,
            isRainRisk: todayForecast.riesgoLluvia,
            contributesToChillHours: weatherData.current.tempC < 7,
          },
          create: {
            farmId: farm.id,
            timestamp: today,
            tempC: weatherData.current.tempC,
            tempMinC: todayForecast.tempMinC,
            tempMaxC: todayForecast.tempMaxC,
            precipMm: todayForecast.precipMm,
            windSpeedKmh: weatherData.current.windSpeedKmh,
            windDirection: weatherData.current.windDirection,
            humidity: weatherData.current.humidity,
            solarRadiation: weatherData.current.solarRadiation,
            etMm: todayForecast.etMm,
            isBelowFrostThreshold: todayForecast.riesgoHelada,
            isRainRisk: todayForecast.riesgoLluvia,
            contributesToChillHours: weatherData.current.tempC < 7,
          },
        })
        .catch(console.error);
    }

    return NextResponse.json({
      farm: { id: farm.id, name: farm.name, commune: farm.commune, latitude: farm.latitude, longitude: farm.longitude },
      weather: weatherData,
      risks,
      activeCycle: activeCycle
        ? {
            id: activeCycle.id,
            phenologicalStage: activeCycle.phenologicalStage,
            chillHoursAccumulated: activeCycle.chillHoursAccumulated,
            estimatedHarvestDate: activeCycle.estimatedHarvestDate,
          }
        : null,
    });
  } catch (error) {
    console.error("[WEATHER_GET]", error);
    return NextResponse.json({ error: "Error fetching weather" }, { status: 500 });
  }
}
