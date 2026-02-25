/**
 * Construye el contexto agronómico completo para el agente IA.
 * Incluye datos del predio, ciclos activos, clima reciente y costos.
 */

import { db } from "@/lib/db";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { detectarRiesgos } from "@/lib/weather/indicators";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

  if (!farm) return "Sin datos de predio disponibles.";

  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

  // Clima actual
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
## Condiciones climáticas actuales (${today})
- Temperatura: ${weather.current.tempC.toFixed(1)}°C
- Humedad relativa: ${weather.current.humidity}%
- Precipitación: ${weather.current.precipMm} mm
- Viento: ${weather.current.windSpeedKmh.toFixed(0)} km/h

### Pronóstico 7 días:
${weather.forecast
  .slice(0, 7)
  .map(
    (d) =>
      `- ${d.date}: max ${d.tempMaxC.toFixed(1)}°C / min ${d.tempMinC.toFixed(1)}°C, lluvia ${d.precipMm.toFixed(1)}mm${d.riesgoHelada ? " ⚠️HELADA" : ""}${d.riesgoLluvia ? " ⚠️LLUVIA" : ""}${d.riesgoCalor ? " ⚠️CALOR" : ""}`
  )
  .join("\n")}

### Riesgos detectados: ${riesgos.length === 0 ? "Ninguno" : ""}
${riesgos.map((r) => `- [${r.severidad}] ${r.titulo}: ${r.recomendacion}`).join("\n")}`;
  } catch {
    weatherContext = "## Clima: No disponible en este momento.";
  }

  // Ciclos activos
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
        .map((i) => `  * ${format(i.date, "d MMM", { locale: es })}: ${i.name} (${i.quantity}${i.unit}) — $${i.totalCost.toLocaleString("es-CL")}`)
        .join("\n");
      const ultimaLabor = cy.laborRecords
        .slice(0, 5)
        .map((l) => `  * ${format(l.date, "d MMM", { locale: es })}: ${l.activity} — ${l.workerCount} personas × ${l.hoursPerWorker}h`)
        .join("\n");

      return `
### Ciclo: ${cy.variedad} · ${cy.loteNombre} (${cy.loteArea} ha)
- Temporada: ${cy.season}
- Estado fenológico: ${ESTADO_FENOLOGICO_LABELS[cy.estadoFenologico]}
- Horas frío acumuladas: ${cy.horasFrioAcumuladas}h (meta: 800h)
- Calibre estimado: ${cy.calibreEstimado?.toFixed(1) ?? "No definido"} mm
- Rendimiento estimado: ${cy.rendimientoEstimado ? `${(cy.rendimientoEstimado / 1000).toFixed(1)} t/ha` : "No definido"}
- Fecha cosecha estimada: ${cy.fechaCosechaEstimada ? format(cy.fechaCosechaEstimada, "d MMM yyyy", { locale: es }) : "No definida"}
- Destino: ${DESTINO_LABELS[cy.destinoProduccion]}
- Costo insumos acumulado: $${costoInsumos.toLocaleString("es-CL")} CLP
- Costo mano de obra: $${costoLabor.toLocaleString("es-CL")} CLP
- Costo total: $${(costoInsumos + costoLabor).toLocaleString("es-CL")} CLP (${Math.round((costoInsumos + costoLabor) / cy.loteArea / 1000)}k CLP/ha)
${cy.notas ? `- Notas del agrónomo: ${cy.notas}` : ""}

Últimos insumos:
${ultimosInsumos || "  (Sin registros recientes)"}

Últimas jornadas:
${ultimaLabor || "  (Sin registros recientes)"}`;
    })
    .join("\n");

  // Historial climático reciente
  const climaHistorial =
    farm.weatherLogs.length > 0
      ? farm.weatherLogs
          .slice(0, 7)
          .map(
            (w) =>
              `- ${format(w.timestamp, "d MMM", { locale: es })}: ${w.tempC.toFixed(1)}°C (min ${w.tempMinC?.toFixed(1) ?? "?"}°C / max ${w.tempMaxC?.toFixed(1) ?? "?"}°C), lluvia ${w.precipMm}mm`
          )
          .join("\n")
      : "Sin historial climático registrado.";

  // Alertas activas
  const alertasContext =
    farm.alerts.length > 0
      ? farm.alerts
          .map((a) => `- [${a.severity}] ${a.title}: ${a.description.slice(0, 150)}...`)
          .join("\n")
      : "Sin alertas activas.";

  return `# Contexto del predio — ${today}

## Predio: ${farm.name}
- Ubicación: ${farm.commune}, ${farm.region}, Chile
- Coordenadas: ${farm.latitude.toFixed(4)}°S, ${Math.abs(farm.longitude).toFixed(4)}°O
- Superficie total: ${farm.totalArea} ha

${weatherContext}

## Historial climático últimos 7 días:
${climaHistorial}

## Ciclos productivos activos:
${ciclosContext}

## Alertas activas:
${alertasContext}`;
}
