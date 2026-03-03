/**
 * Agronomic risk indicators for cherry trees
 * Maule Region — Regina and Bing varieties
 */

import type { ForecastDay } from "./open-meteo";
import type { EstadoFenologico } from "@prisma/client";

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

export interface RiesgoDetectado {
  tipo: "HELADA" | "LLUVIA_COSECHA" | "GOLPE_CALOR" | "VIENTO_FUERTE" | "HUMEDAD_ALTA" | "DEFICIT_HORAS_FRIO";
  severidad: "CRITICA" | "ADVERTENCIA" | "INFO";
  titulo: string;
  descripcion: string;
  recomendacion: string;
  fechas: string[];  // affected days
  valorTrigger: number;
}

// ─── Risk detection engine ─────────────────────────────────────────────────

export function detectarRiesgos(
  forecast: ForecastDay[],
  estadoFenologico: EstadoFenologico,
  horasFrioAcumuladas: number,
  humidadActual?: number
): RiesgoDetectado[] {
  const riesgos: RiesgoDetectado[] = [];

  // 1. FROST — only critical during flowering and fruit set
  const esEstadoSensibleHelada =
    estadoFenologico === "FLORACION" || estadoFenologico === "CUAJA";

  const diasHelada = forecast.filter((d) => d.riesgoHelada);
  if (diasHelada.length > 0 && esEstadoSensibleHelada) {
    const minTemp = Math.min(...diasHelada.map((d) => d.tempMinC));
    riesgos.push({
      tipo: "HELADA",
      severidad: "CRITICA",
      titulo: `Frost forecast — ${diasHelada.length} day(s)`,
      descripcion: `Minimum temperature of ${minTemp.toFixed(1)}°C. At ${estadoFenologico.toLowerCase().replace("_", " ")} stage, frost causes irreversible damage to the pistil.`,
      recomendacion:
        "Activate nighttime anti-frost sprinkler system. Monitor temperature hourly from 10:00 PM. Consider paraffin heaters if temp < -2°C.",
      fechas: diasHelada.map((d) => d.date),
      valorTrigger: minTemp,
    });
  } else if (diasHelada.length > 0) {
    const minTemp = Math.min(...diasHelada.map((d) => d.tempMinC));
    riesgos.push({
      tipo: "HELADA",
      severidad: "INFO",
      titulo: `Low temperature forecast`,
      descripcion: `Minimum of ${minTemp.toFixed(1)}°C. Not critical at current phenological stage (${estadoFenologico}).`,
      recomendacion: "Monitor. No immediate action required.",
      fechas: diasHelada.map((d) => d.date),
      valorTrigger: minTemp,
    });
  }

  // 2. RAIN AT HARVEST — critical during ripening and fruit filling
  const esEstadoSensibleLluvia =
    estadoFenologico === "MADUREZ" ||
    estadoFenologico === "LLENADO_FRUTO" ||
    estadoFenologico === "CRECIMIENTO_FRUTO";

  const diasLluvia = forecast.filter((d) => d.riesgoLluvia);
  if (diasLluvia.length > 0 && esEstadoSensibleLluvia) {
    const maxPrecip = Math.max(...diasLluvia.map((d) => d.precipMm));
    const severidad = maxPrecip > 5 ? "CRITICA" : "ADVERTENCIA";
    riesgos.push({
      tipo: "LLUVIA_COSECHA",
      severidad,
      titulo: `Rain during critical period — ${diasLluvia.length} day(s)`,
      descripcion: `${maxPrecip.toFixed(1)} mm maximum forecast. During ${estadoFenologico === "MADUREZ" ? "harvest" : "fruit filling"}, rain splits the epicarp and reduces exportable percentage.`,
      recomendacion:
        estadoFenologico === "MADUREZ"
          ? "URGENT: Advance harvest if Brix ≥ 16 and color ≥ 80%. Apply foliar calcium (CaCl₂ 0.5%) before rain. Check rain cover."
          : "Check rain cover and ensure soil drainage. Apply preventive foliar calcium. Suspend irrigation 48h before.",
      fechas: diasLluvia.map((d) => d.date),
      valorTrigger: maxPrecip,
    });
  }

  // 3. HEAT STRESS — critical during filling and ripening
  const esEstadoSensibleCalor =
    estadoFenologico === "LLENADO_FRUTO" ||
    estadoFenologico === "MADUREZ" ||
    estadoFenologico === "CUAJA";

  const diasCalor = forecast.filter((d) => d.riesgoCalor);
  if (diasCalor.length > 0 && esEstadoSensibleCalor) {
    const maxTemp = Math.max(...diasCalor.map((d) => d.tempMaxC));
    riesgos.push({
      tipo: "GOLPE_CALOR",
      severidad: maxTemp > 38 ? "CRITICA" : "ADVERTENCIA",
      titulo: `Heat stress — ${maxTemp.toFixed(1)}°C`,
      descripcion: `${diasCalor.length} day(s) above 35°C. During fruit filling, each degree above 35°C reduces final caliber by ~0.3mm and accelerates ripening.`,
      recomendacion:
        "Apply kaolin (Surround WP) 25 kg/ha. Activate micro-sprinklers over canopy 12:00-5:00 PM (3 cycles of 10 min). Monitor temperature under canopy.",
      fechas: diasCalor.map((d) => d.date),
      valorTrigger: maxTemp,
    });
  }

  // 4. STRONG WIND
  const diasViento = forecast.filter((d) => d.windSpeedMaxKmh > UMBRALES.VIENTO_FUERTE);
  if (diasViento.length > 0) {
    const maxViento = Math.max(...diasViento.map((d) => d.windSpeedMaxKmh));
    riesgos.push({
      tipo: "VIENTO_FUERTE",
      severidad: maxViento > 80 ? "CRITICA" : "ADVERTENCIA",
      titulo: `Strong wind — ${maxViento.toFixed(0)} km/h`,
      descripcion: `Wind above ${UMBRALES.VIENTO_FUERTE} km/h can damage netting, defoliate branches, and hinder phytosanitary applications.`,
      recomendacion:
        "Inspect and secure netting and structures. Suspend backpack or tractor applications. Check condition of stakes.",
      fechas: diasViento.map((d) => d.date),
      valorTrigger: maxViento,
    });
  }

  // 5. HIGH HUMIDITY (if current value is passed)
  if (humidadActual && humidadActual > UMBRALES.HUMEDAD_ALTA) {
    riesgos.push({
      tipo: "HUMEDAD_ALTA",
      severidad: "ADVERTENCIA",
      titulo: `High relative humidity — ${humidadActual}%`,
      descripcion:
        "Humidity above 90% favors development of Botrytis cinerea (gray mold), especially on fruit close to harvest.",
      recomendacion:
        "Apply preventive fungicide (Fludioxonil or Iprodione). Improve ventilation in areas with dense foliage. Avoid nighttime irrigation.",
      fechas: [new Date().toISOString().split("T")[0]],
      valorTrigger: humidadActual,
    });
  }

  // 6. CHILL HOURS DEFICIT — relevant only during budbreak
  if (
    estadoFenologico === "BROTAMIENTO" &&
    horasFrioAcumuladas < UMBRALES.HORAS_FRIO_MINIMO
  ) {
    const deficit = UMBRALES.HORAS_FRIO_META - horasFrioAcumuladas;
    riesgos.push({
      tipo: "DEFICIT_HORAS_FRIO",
      severidad: horasFrioAcumuladas < 600 ? "CRITICA" : "ADVERTENCIA",
      titulo: `Chill hours deficit — ${horasFrioAcumuladas}h accumulated`,
      descripcion: `Target: ${UMBRALES.HORAS_FRIO_META}h. Missing ${deficit}h. The deficit causes irregular budbreak, staggered flowering and lower yield.`,
      recomendacion:
        "Evaluate application of hydrogen cyanamide (Dormex 2%) to compensate deficit. Consult with fruit physiology specialist agronomist.",
      fechas: [],
      valorTrigger: horasFrioAcumuladas,
    });
  }

  return riesgos;
}

// ─── Visualization helpers ─────────────────────────────────────────────────

export function getWindDirection(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(degrees / 45) % 8];
}

export function getHorasFrioColor(horas: number): string {
  if (horas >= UMBRALES.HORAS_FRIO_META) return "text-green-600";
  if (horas >= UMBRALES.HORAS_FRIO_MINIMO) return "text-yellow-600";
  return "text-red-600";
}

export function getHorasFrioPct(horas: number): number {
  return Math.min(100, Math.round((horas / UMBRALES.HORAS_FRIO_META) * 100));
}

export function formatFechaCorta(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
