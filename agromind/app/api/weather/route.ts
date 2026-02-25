import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos } from "@/lib/weather/indicators";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");

  try {
    // Obtener la farm con el ciclo activo
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

    // Obtener datos de clima desde Open-Meteo
    const weatherData = await fetchWeather(farm.latitude, farm.longitude);

    // Extraer el ciclo activo más reciente
    const cicloActivo = farm.lots
      .flatMap((l) => l.crops)
      .flatMap((c) => c.productionCycles)
      .find((cy) => cy.isActive);

    // Calcular riesgos para cerezos
    const riesgos = detectarRiesgos(
      weatherData.forecast,
      cicloActivo?.estadoFenologico ?? "CUAJA",
      cicloActivo?.horasFrioAcumuladas ?? 0,
      weatherData.current.humidity
    );

    // Guardar registro climático del día actual en DB (fire-and-forget)
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
