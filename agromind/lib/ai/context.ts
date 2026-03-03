/**
 * Builds complete agronomic context for AI agent.
 * Includes farm data, active cycles, recent weather and costs.
 */

import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos } from "@/lib/weather/indicators";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { ESTADO_FENOLOGICO_LABELS, DESTINO_LABELS } from "@/types";

export async function buildAgronomicContext(clerkId: string): Promise<string> {
  const farm = await db.farm.findFirst({
    where: { owner: { clerkId } },
    include: {
      lots: {
        include: {
          crops: {
            include: {
              productionCycles: {
                where: { isActive: true },
                include: {
                  inputs: { orderBy: { date: "desc" }, take: 10 },
                  laborRecords: { orderBy: { date: "desc" }, take: 10 },
                },
              },
            },
          },
        },
      },
      weatherLogs: { orderBy: { timestamp: "desc" }, take: 14 },
      alerts: { where: { isResolved: false }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!farm) return "No farm data available.";

  const today = format(new Date(), "MMMM d, yyyy", { locale: enUS });

  // Current weather
  let weatherContext = "";
  try {
    const weather = await fetchWeather(farm.latitude, farm.longitude);
    const cicloRef = farm.lots.flatMap((l) => l.crops.flatMap((c) => c.productionCycles))[0];
    const riesgos = detectarRiesgos(
      weather.forecast,
      cicloRef?.estadoFenologico ?? "CUAJA",
      cicloRef?.horasFrioAcumuladas ?? 0,
      weather.current.humidity
    );

    weatherContext = `
## Current Weather Conditions (${today})
- Temperature: ${weather.current.tempC.toFixed(1)}°C
- Relative humidity: ${weather.current.humidity}%
- Precipitation: ${weather.current.precipMm} mm
- Wind: ${weather.current.windSpeedKmh.toFixed(0)} km/h

### 7-Day Forecast:
${weather.forecast
  .slice(0, 7)
  .map(
    (d) =>
      `- ${d.date}: max ${d.tempMaxC.toFixed(1)}°C / min ${d.tempMinC.toFixed(1)}°C, rain ${d.precipMm.toFixed(1)}mm${d.riesgoHelada ? " ⚠️FROST" : ""}${d.riesgoLluvia ? " ⚠️RAIN" : ""}${d.riesgoCalor ? " ⚠️HEAT" : ""}`
  )
  .join("\n")}

### Detected Risks: ${riesgos.length === 0 ? "None" : ""}
${riesgos.map((r) => `- [${r.severidad}] ${r.titulo}: ${r.recomendacion}`).join("\n")}`;
  } catch {
    weatherContext = "## Weather: Not available at this time.";
  }

  // Active cycles
  const ciclos = farm.lots.flatMap((l) =>
    l.crops.flatMap((c) =>
      c.productionCycles.map((cy) => ({
        ...cy,
        variedad: c.variety,
        loteNombre: l.name,
        loteArea: l.area,
      }))
    )
  );

  const ciclosContext = ciclos
    .map((cy) => {
      const costoInsumos = cy.inputs.reduce((s, i) => s + i.totalCost, 0);
      const costoLabor = cy.laborRecords.reduce((s, l) => s + l.totalCost, 0);
      const ultimosInsumos = cy.inputs
        .slice(0, 5)
        .map((i) => `  * ${format(i.date, "MMM d", { locale: enUS })}: ${i.name} (${i.quantity}${i.unit}) — $${i.totalCost.toLocaleString("en-US")}`)
        .join("\n");
      const ultimaLabor = cy.laborRecords
        .slice(0, 5)
        .map((l) => `  * ${format(l.date, "MMM d", { locale: enUS })}: ${l.activity} — ${l.workerCount} workers × ${l.hoursPerWorker}h`)
        .join("\n");

      return `
### Cycle: ${cy.variedad} · ${cy.loteNombre} (${cy.loteArea} ha)
- Season: ${cy.season}
- Phenological stage: ${ESTADO_FENOLOGICO_LABELS[cy.estadoFenologico]}
- Accumulated chill hours: ${cy.horasFrioAcumuladas}h (target: 800h)
- Estimated size: ${cy.calibreEstimado?.toFixed(1) ?? "Not defined"} mm
- Estimated yield: ${cy.rendimientoEstimado ? `${(cy.rendimientoEstimado / 1000).toFixed(1)} t/ha` : "Not defined"}
- Estimated harvest date: ${cy.fechaCosechaEstimada ? format(cy.fechaCosechaEstimada, "MMM d, yyyy", { locale: enUS }) : "Not defined"}
- Destination: ${DESTINO_LABELS[cy.destinoProduccion]}
- Accumulated input cost: $${costoInsumos.toLocaleString("en-US")} CLP
- Labor cost: $${costoLabor.toLocaleString("en-US")} CLP
- Total cost: $${(costoInsumos + costoLabor).toLocaleString("en-US")} CLP (${Math.round((costoInsumos + costoLabor) / cy.loteArea / 1000)}k CLP/ha)
${cy.notas ? `- Agronomist notes: ${cy.notas}` : ""}

Recent inputs:
${ultimosInsumos || "  (No recent records)"}

Recent labor:
${ultimaLabor || "  (No recent records)"}`;
    })
    .join("\n");

  // Recent weather history
  const climaHistorial =
    farm.weatherLogs.length > 0
      ? farm.weatherLogs
          .slice(0, 7)
          .map(
            (w) =>
              `- ${format(w.timestamp, "MMM d", { locale: enUS })}: ${w.tempC.toFixed(1)}°C (min ${w.tempMinC?.toFixed(1) ?? "?"}°C / max ${w.tempMaxC?.toFixed(1) ?? "?"}°C), rain ${w.precipMm}mm`
          )
          .join("\n")
      : "No recorded weather history.";

  // Active alerts
  const alertasContext =
    farm.alerts.length > 0
      ? farm.alerts
          .map((a) => `- [${a.severity}] ${a.title}: ${a.description.slice(0, 150)}...`)
          .join("\n")
      : "No active alerts.";

  return `# Farm Context — ${today}

## Farm: ${farm.name}
- Location: ${farm.commune}, ${farm.region}, Chile
- Coordinates: ${farm.latitude.toFixed(4)}°S, ${Math.abs(farm.longitude).toFixed(4)}°W
- Total area: ${farm.totalArea} ha

${weatherContext}

## Recent weather history (last 7 days):
${climaHistorial}

## Active production cycles:
${ciclosContext}

## Active alerts:
${alertasContext}`;
}
