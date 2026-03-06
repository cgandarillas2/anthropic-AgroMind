/**
 * Agronomic risk indicators for cherry trees
 * Maule Region — Regina and Bing varieties
 */

import type { ForecastDay } from "./open-meteo";
import type { PhenologicalStage } from "@prisma/client";

// ─── Critical thresholds for cherry trees ──────────────────────────────────

export const UMBRALES = {
  HELADA_CRITICA:     -1,   // °C — irreversible damage during flowering
  HELADA_LEVE:         2,   // °C — warning
  LLUVIA_RIESGO:       1,   // mm — splits fruit at harvest
  CALOR_CRITICO:      35,   // °C — reduces caliber during filling
  CALOR_ADVERTENCIA:  32,   // °C — moderate stress
  HORAS_FRIO_META:   800,   // h < 7°C — dormancy requirement
  HORAS_FRIO_MINIMO: 700,   // h — minimum for normal budbreak
  VIENTO_FUERTE:      60,   // km/h
  HUMEDAD_ALTA:       90,   // % — fungal risk (botrytis)
} as const;

// ─── Detected alert types ──────────────────────────────────────────────────

export interface DetectedRisk {
  type: "FROST" | "HARVEST_RAIN" | "HEAT_WAVE" | "STRONG_WIND" | "HIGH_HUMIDITY" | "CHILL_HOUR_DEFICIT";
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  description: string;
  recommendation: string;
  dates: string[];  // affected days
  triggerValue: number;
}

// ─── Risk detection engine ─────────────────────────────────────────────────

export function detectRisks(
  forecast: ForecastDay[],
  phenologicalStage: PhenologicalStage,
  chillHoursAccumulated: number,
  currentHumidity?: number
): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  // 1. FROST — only critical during flowering and fruit set
  const isFrostSensitiveStage =
    phenologicalStage === "FLOWERING" || phenologicalStage === "FRUIT_SET";

  const frostDays = forecast.filter((d) => d.riesgoHelada);
  if (frostDays.length > 0 && isFrostSensitiveStage) {
    const minTemp = Math.min(...frostDays.map((d) => d.tempMinC));
    risks.push({
      type: "FROST",
      severity: "CRITICAL",
      title: `Frost forecast — ${frostDays.length} day(s)`,
      description: `Minimum temperature of ${minTemp.toFixed(1)}°C. At ${phenologicalStage.toLowerCase().replace("_", " ")} stage, frost causes irreversible damage to the pistil.`,
      recommendation:
        "Activate nighttime anti-frost sprinkler system. Monitor temperature hourly from 10:00 PM. Consider paraffin heaters if temp < -2°C.",
      dates: frostDays.map((d) => d.date),
      triggerValue: minTemp,
    });
  } else if (frostDays.length > 0) {
    const minTemp = Math.min(...frostDays.map((d) => d.tempMinC));
    risks.push({
      type: "FROST",
      severity: "INFO",
      title: `Low temperature forecast`,
      description: `Minimum of ${minTemp.toFixed(1)}°C. Not critical at current phenological stage (${phenologicalStage}).`,
      recommendation: "Monitor. No immediate action required.",
      dates: frostDays.map((d) => d.date),
      triggerValue: minTemp,
    });
  }

  // 2. RAIN AT HARVEST — critical during ripening and fruit filling
  const isRainSensitiveStage =
    phenologicalStage === "MATURITY" ||
    phenologicalStage === "FRUIT_FILL" ||
    phenologicalStage === "FRUIT_GROWTH";

  const rainDays = forecast.filter((d) => d.riesgoLluvia);
  if (rainDays.length > 0 && isRainSensitiveStage) {
    const maxPrecip = Math.max(...rainDays.map((d) => d.precipMm));
    const severity = maxPrecip > 5 ? "CRITICAL" : "WARNING";
    risks.push({
      type: "HARVEST_RAIN",
      severity,
      title: `Rain during critical period — ${rainDays.length} day(s)`,
      description: `${maxPrecip.toFixed(1)} mm maximum forecast. During ${phenologicalStage === "MATURITY" ? "harvest" : "fruit filling"}, rain splits the epicarp and reduces exportable percentage.`,
      recommendation:
        phenologicalStage === "MATURITY"
          ? "URGENT: Advance harvest if Brix ≥ 16 and color ≥ 80%. Apply foliar calcium (CaCl₂ 0.5%) before rain. Check rain cover."
          : "Check rain cover and ensure soil drainage. Apply preventive foliar calcium. Suspend irrigation 48h before.",
      dates: rainDays.map((d) => d.date),
      triggerValue: maxPrecip,
    });
  }

  // 3. HEAT STRESS — critical during filling and ripening
  const isHeatSensitiveStage =
    phenologicalStage === "FRUIT_FILL" ||
    phenologicalStage === "MATURITY" ||
    phenologicalStage === "FRUIT_SET";

  const heatDays = forecast.filter((d) => d.riesgoCalor);
  if (heatDays.length > 0 && isHeatSensitiveStage) {
    const maxTemp = Math.max(...heatDays.map((d) => d.tempMaxC));
    risks.push({
      type: "HEAT_WAVE",
      severity: maxTemp > 38 ? "CRITICAL" : "WARNING",
      title: `Heat stress — ${maxTemp.toFixed(1)}°C`,
      description: `${heatDays.length} day(s) above 35°C. During fruit filling, each degree above 35°C reduces final caliber by ~0.3mm and accelerates ripening.`,
      recommendation:
        "Apply kaolin (Surround WP) 25 kg/ha. Activate micro-sprinklers over canopy 12:00-5:00 PM (3 cycles of 10 min). Monitor temperature under canopy.",
      dates: heatDays.map((d) => d.date),
      triggerValue: maxTemp,
    });
  }

  // 4. STRONG WIND
  const windDays = forecast.filter((d) => d.windSpeedMaxKmh > UMBRALES.VIENTO_FUERTE);
  if (windDays.length > 0) {
    const maxWind = Math.max(...windDays.map((d) => d.windSpeedMaxKmh));
    risks.push({
      type: "STRONG_WIND",
      severity: maxWind > 80 ? "CRITICAL" : "WARNING",
      title: `Strong wind — ${maxWind.toFixed(0)} km/h`,
      description: `Wind above ${UMBRALES.VIENTO_FUERTE} km/h can damage netting, defoliate branches, and hinder phytosanitary applications.`,
      recommendation:
        "Inspect and secure netting and structures. Suspend backpack or tractor applications. Check condition of stakes.",
      dates: windDays.map((d) => d.date),
      triggerValue: maxWind,
    });
  }

  // 5. HIGH HUMIDITY (if current value is passed)
  if (currentHumidity && currentHumidity > UMBRALES.HUMEDAD_ALTA) {
    risks.push({
      type: "HIGH_HUMIDITY",
      severity: "WARNING",
      title: `High relative humidity — ${currentHumidity}%`,
      description:
        "Humidity above 90% favors development of Botrytis cinerea (gray mold), especially on fruit close to harvest.",
      recommendation:
        "Apply preventive fungicide (Fludioxonil or Iprodione). Improve ventilation in areas with dense foliage. Avoid nighttime irrigation.",
      dates: [new Date().toISOString().split("T")[0]],
      triggerValue: currentHumidity,
    });
  }

  // 6. CHILL HOURS DEFICIT — relevant only during budbreak
  if (
    phenologicalStage === "BUDBREAK" &&
    chillHoursAccumulated < UMBRALES.HORAS_FRIO_MINIMO
  ) {
    const deficit = UMBRALES.HORAS_FRIO_META - chillHoursAccumulated;
    risks.push({
      type: "CHILL_HOUR_DEFICIT",
      severity: chillHoursAccumulated < 600 ? "CRITICAL" : "WARNING",
      title: `Chill hours deficit — ${chillHoursAccumulated}h accumulated`,
      description: `Target: ${UMBRALES.HORAS_FRIO_META}h. Missing ${deficit}h. The deficit causes irregular budbreak, staggered flowering and lower yield.`,
      recommendation:
        "Evaluate application of hydrogen cyanamide (Dormex 2%) to compensate deficit. Consult with fruit physiology specialist agronomist.",
      dates: [],
      triggerValue: chillHoursAccumulated,
    });
  }

  return risks;
}

// ─── Visualization helpers ─────────────────────────────────────────────────

export function getWindDirection(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(degrees / 45) % 8];
}

export function getChillHoursColor(hours: number): string {
  if (hours >= UMBRALES.HORAS_FRIO_META) return "text-green-600";
  if (hours >= UMBRALES.HORAS_FRIO_MINIMO) return "text-yellow-600";
  return "text-red-600";
}

export function getChillHoursPct(hours: number): number {
  return Math.min(100, Math.round((hours / UMBRALES.HORAS_FRIO_META) * 100));
}

export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
