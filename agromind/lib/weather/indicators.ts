/**
 * Indicadores de riesgo agronómico para cerezos
 * Región del Maule — variedades Regina y Bing
 */

import type { ForecastDay } from "./open-meteo";
import type { EstadoFenologico } from "@prisma/client";

// ─── Umbrales críticos para cerezos ────────────────────────────────────────

export const UMBRALES = {
  HELADA_CRITICA:     -1,   // °C — daño irreversible en floración
  HELADA_LEVE:         2,   // °C — advertencia
  LLUVIA_RIESGO:       1,   // mm — raja el fruto en cosecha
  CALOR_CRITICO:      35,   // °C — reduce calibre en llenado
  CALOR_ADVERTENCIA:  32,   // °C — estrés moderado
  HORAS_FRIO_META:   800,   // h < 7°C — requerimiento de dormancia
  HORAS_FRIO_MINIMO: 700,   // h — mínimo para brotamiento normal
  VIENTO_FUERTE:      60,   // km/h
  HUMEDAD_ALTA:       90,   // % — riesgo de hongos (botrytis)
} as const;

// ─── Tipos de alerta detectada ─────────────────────────────────────────────

export interface RiesgoDetectado {
  tipo: "HELADA" | "LLUVIA_COSECHA" | "GOLPE_CALOR" | "VIENTO_FUERTE" | "HUMEDAD_ALTA" | "DEFICIT_HORAS_FRIO";
  severidad: "CRITICA" | "ADVERTENCIA" | "INFO";
  titulo: string;
  descripcion: string;
  recomendacion: string;
  fechas: string[];  // días afectados
  valorTrigger: number;
}

// ─── Motor de detección de riesgos ─────────────────────────────────────────

export function detectarRiesgos(
  forecast: ForecastDay[],
  estadoFenologico: EstadoFenologico,
  horasFrioAcumuladas: number,
  humidadActual?: number
): RiesgoDetectado[] {
  const riesgos: RiesgoDetectado[] = [];

  // 1. HELADA — solo crítica en floración y cuaja
  const esEstadoSensibleHelada =
    estadoFenologico === "FLORACION" || estadoFenologico === "CUAJA";

  const diasHelada = forecast.filter((d) => d.riesgoHelada);
  if (diasHelada.length > 0 && esEstadoSensibleHelada) {
    const minTemp = Math.min(...diasHelada.map((d) => d.tempMinC));
    riesgos.push({
      tipo: "HELADA",
      severidad: "CRITICA",
      titulo: `Helada pronosticada — ${diasHelada.length} día(s)`,
      descripcion: `Temperatura mínima de ${minTemp.toFixed(1)}°C. En estado de ${estadoFenologico.toLowerCase().replace("_", " ")}, las heladas causan daño irreversible al pistilo.`,
      recomendacion:
        "Activar sistema de aspersión antipélada nocturna. Monitorear temperatura cada hora desde las 22:00h. Considerar calefactores de parafina si temp < -2°C.",
      fechas: diasHelada.map((d) => d.date),
      valorTrigger: minTemp,
    });
  } else if (diasHelada.length > 0) {
    const minTemp = Math.min(...diasHelada.map((d) => d.tempMinC));
    riesgos.push({
      tipo: "HELADA",
      severidad: "INFO",
      titulo: `Temperatura baja pronosticada`,
      descripcion: `Mínima de ${minTemp.toFixed(1)}°C. No crítica en el estado fenológico actual (${estadoFenologico}).`,
      recomendacion: "Monitorear. Sin acción inmediata requerida.",
      fechas: diasHelada.map((d) => d.date),
      valorTrigger: minTemp,
    });
  }

  // 2. LLUVIA EN COSECHA — crítica en madurez y llenado de fruto
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
      titulo: `Lluvia en período crítico — ${diasLluvia.length} día(s)`,
      descripcion: `${maxPrecip.toFixed(1)} mm máximo pronosticado. En ${estadoFenologico === "MADUREZ" ? "cosecha" : "llenado de fruto"}, la lluvia raja el epicarpio y reduce el porcentaje exportable.`,
      recomendacion:
        estadoFenologico === "MADUREZ"
          ? "URGENTE: Adelantar cosecha si Brix ≥ 16 y color ≥ 80%. Aplicar calcio foliar (CaCl₂ 0.5%) antes de la lluvia. Revisar malla antiluvia."
          : "Revisar malla antiluvia y asegurar drenaje de suelo. Aplicar calcio foliar preventivo. Suspender riego 48h antes.",
      fechas: diasLluvia.map((d) => d.date),
      valorTrigger: maxPrecip,
    });
  }

  // 3. GOLPE DE CALOR — crítico en llenado y madurez
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
      titulo: `Golpe de calor — ${maxTemp.toFixed(1)}°C`,
      descripcion: `${diasCalor.length} día(s) sobre 35°C. En llenado de fruto, cada grado sobre 35°C reduce el calibre final en ~0.3mm y acelera la maduración.`,
      recomendacion:
        "Aplicar kaolín (Surround WP) 25 kg/ha. Activar microaspersión sobre copa 12:00-17:00h (3 ciclos de 10 min). Monitorear temperatura bajo dosel.",
      fechas: diasCalor.map((d) => d.date),
      valorTrigger: maxTemp,
    });
  }

  // 4. VIENTO FUERTE
  const diasViento = forecast.filter((d) => d.windSpeedMaxKmh > UMBRALES.VIENTO_FUERTE);
  if (diasViento.length > 0) {
    const maxViento = Math.max(...diasViento.map((d) => d.windSpeedMaxKmh));
    riesgos.push({
      tipo: "VIENTO_FUERTE",
      severidad: maxViento > 80 ? "CRITICA" : "ADVERTENCIA",
      titulo: `Viento fuerte — ${maxViento.toFixed(0)} km/h`,
      descripcion: `Viento sobre ${UMBRALES.VIENTO_FUERTE} km/h puede dañar mallas, defoliar ramas y dificultar aplicaciones fitosanitarias.`,
      recomendacion:
        "Revisar y asegurar mallas y estructuras. Suspender aplicaciones con mochila o tractor. Verificar estado de tutores.",
      fechas: diasViento.map((d) => d.date),
      valorTrigger: maxViento,
    });
  }

  // 5. HUMEDAD ALTA (si se pasa el valor actual)
  if (humidadActual && humidadActual > UMBRALES.HUMEDAD_ALTA) {
    riesgos.push({
      tipo: "HUMEDAD_ALTA",
      severidad: "ADVERTENCIA",
      titulo: `Humedad relativa alta — ${humidadActual}%`,
      descripcion:
        "Humedad sobre 90% favorece el desarrollo de Botrytis cinerea (pudrición gris), especialmente en frutos próximos a cosecha.",
      recomendacion:
        "Aplicar fungicida preventivo (Fludioxonil o Iprodione). Mejorar ventilación en zonas con follaje denso. Evitar riego nocturno.",
      fechas: [new Date().toISOString().split("T")[0]],
      valorTrigger: humidadActual,
    });
  }

  // 6. DÉFICIT DE HORAS FRÍO — relevante solo en brotamiento
  if (
    estadoFenologico === "BROTAMIENTO" &&
    horasFrioAcumuladas < UMBRALES.HORAS_FRIO_MINIMO
  ) {
    const deficit = UMBRALES.HORAS_FRIO_META - horasFrioAcumuladas;
    riesgos.push({
      tipo: "DEFICIT_HORAS_FRIO",
      severidad: horasFrioAcumuladas < 600 ? "CRITICA" : "ADVERTENCIA",
      titulo: `Déficit de horas frío — ${horasFrioAcumuladas}h acumuladas`,
      descripcion: `Meta: ${UMBRALES.HORAS_FRIO_META}h. Faltan ${deficit}h. El déficit causa brotamiento irregular, floraciones escalonadas y menor rendimiento.`,
      recomendacion:
        "Evaluar aplicación de cianamida hidrogenada (Dormex 2%) para compensar déficit. Consultar con agrónomo especialista en fisiología frutal.",
      fechas: [],
      valorTrigger: horasFrioAcumuladas,
    });
  }

  return riesgos;
}

// ─── Helpers de visualización ──────────────────────────────────────────────

export function getWindDirection(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
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
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}
