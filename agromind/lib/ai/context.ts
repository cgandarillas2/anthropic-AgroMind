/**
 * Builds complete agronomic context for AI agent.
 * Includes farm data, active cycles, recent weather and costs.
 */

import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectRisks } from "@/lib/weather/indicators";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { PHENOLOGICAL_STAGE_LABELS, DESTINATION_LABELS } from "@/types";

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
    const cycleRef = farm.lots.flatMap((l) => l.crops.flatMap((c) => c.productionCycles))[0];
    const risks = detectRisks(
      weather.forecast,
      cycleRef?.phenologicalStage ?? "FRUIT_SET",
      cycleRef?.chillHoursAccumulated ?? 0,
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

### Detected Risks: ${risks.length === 0 ? "None" : ""}
${risks.map((r) => `- [${r.severity}] ${r.title}: ${r.recommendation}`).join("\n")}`;
  } catch {
    weatherContext = "## Weather: Not available at this time.";
  }

  // Active cycles
  const cycles = farm.lots.flatMap((l) =>
    l.crops.flatMap((c) =>
      c.productionCycles.map((cy) => ({
        ...cy,
        variety: c.variety,
        lotName: l.name,
        lotArea: l.area,
      }))
    )
  );

  const cyclesContext = cycles
    .map((cy) => {
      const inputsCost = cy.inputs.reduce((s, i) => s + i.totalCost, 0);
      const laborCost = cy.laborRecords.reduce((s, l) => s + l.totalCost, 0);
      const recentInputs = cy.inputs
        .slice(0, 5)
        .map((i) => `  * ${format(i.date, "MMM d", { locale: enUS })}: ${i.name} (${i.quantity}${i.unit}) — $${i.totalCost.toLocaleString("en-US")}`)
        .join("\n");
      const recentLabor = cy.laborRecords
        .slice(0, 5)
        .map((l) => `  * ${format(l.date, "MMM d", { locale: enUS })}: ${l.activity} — ${l.workerCount} workers × ${l.hoursPerWorker}h`)
        .join("\n");

      return `
### Cycle: ${cy.variety} · ${cy.lotName} (${cy.lotArea} ha)
- Season: ${cy.season}
- Phenological stage: ${PHENOLOGICAL_STAGE_LABELS[cy.phenologicalStage]}
- Accumulated chill hours: ${cy.chillHoursAccumulated}h (target: 800h)
- Estimated size: ${cy.estimatedCalibration?.toFixed(1) ?? "Not defined"} mm
- Estimated yield: ${cy.estimatedYield ? `${(cy.estimatedYield / 1000).toFixed(1)} t/ha` : "Not defined"}
- Estimated harvest date: ${cy.estimatedHarvestDate ? format(cy.estimatedHarvestDate, "MMM d, yyyy", { locale: enUS }) : "Not defined"}
- Destination: ${DESTINATION_LABELS[cy.productionDestination]}
- Accumulated input cost: $${inputsCost.toLocaleString("en-US")} CLP
- Labor cost: $${laborCost.toLocaleString("en-US")} CLP
- Total cost: $${(inputsCost + laborCost).toLocaleString("en-US")} CLP (${Math.round((inputsCost + laborCost) / cy.lotArea / 1000)}k CLP/ha)
${cy.notes ? `- Agronomist notes: ${cy.notes}` : ""}

Recent inputs:
${recentInputs || "  (No recent records)"}

Recent labor:
${recentLabor || "  (No recent records)"}`;
    })
    .join("\n");

  // Recent weather history
  const weatherHistory =
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
  const alertsContext =
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
${weatherHistory}

## Active production cycles:
${cyclesContext}

## Active alerts:
${alertsContext}`;
}
