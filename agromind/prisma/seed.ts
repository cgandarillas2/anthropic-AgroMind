/**
 * AgroMind - Seed Script
 *
 * Datos de prueba: Predio cerealero en Curicó, Región del Maule.
 * 2 lotes de 5 ha c/u, variedad Regina, ciclo activo en estado
 * "CUAJA" (fruto cuajado), con registros de las últimas 3 semanas.
 *
 * Fecha de referencia del seed: 2025-01-04 (temporada 2024/2025)
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  EstadoFenologico,
  DestinoProduccion,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
} from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Fechas base (3 semanas atrás desde 2025-01-04) ───
const BASE_DATE = new Date("2025-01-04T12:00:00-03:00");
const daysAgo = (d: number) =>
  new Date(BASE_DATE.getTime() - d * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 Iniciando seed de AgroMind...\n");

  // ─────────────────────────────────────────────
  // 1. USUARIO PROPIETARIO
  // ─────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { clerkId: "seed_user_curico_001" },
    update: {},
    create: {
      clerkId: "seed_user_curico_001",
      email: "carlos.fuentes@agromind.cl",
      name: "Carlos Fuentes Morales",
      role: UserRole.FARMER,
    },
  });
  console.log(`✅ Usuario creado: ${user.name}`);

  // ─────────────────────────────────────────────
  // 2. PREDIO - Fundo Los Ciruelos, Curicó
  //    Coordenadas reales: sur de Curicó (~34.97°S, 71.23°W)
  // ─────────────────────────────────────────────
  const farm = await prisma.farm.upsert({
    where: { id: "farm_curico_001" },
    update: {},
    create: {
      id: "farm_curico_001",
      name: "Fundo Los Nogales",
      address: "Camino Los Nogales s/n, sector Romeral",
      region: "Maule",
      commune: "Curicó",
      latitude: -34.9756,
      longitude: -71.2384,
      totalArea: 12.5, // 10 ha cerezos + 2.5 ha infraestructura/cortinas
      ownerId: user.id,
    },
  });
  console.log(`✅ Predio creado: ${farm.name} (${farm.commune})`);

  // ─────────────────────────────────────────────
  // 3. LOTES
  // ─────────────────────────────────────────────
  const lotA = await prisma.lot.upsert({
    where: { id: "lot_curico_A" },
    update: {},
    create: {
      id: "lot_curico_A",
      name: "Lote A - Sector Norte",
      area: 5.0,
      soilType: "Franco arcillo-limoso",
      slopePerc: 3.5,
      farmId: farm.id,
    },
  });

  const lotB = await prisma.lot.upsert({
    where: { id: "lot_curico_B" },
    update: {},
    create: {
      id: "lot_curico_B",
      name: "Lote B - Sector Sur",
      area: 5.0,
      soilType: "Franco arenoso",
      slopePerc: 2.0,
      farmId: farm.id,
    },
  });
  console.log(`✅ Lotes creados: ${lotA.name} y ${lotB.name}`);

  // ─────────────────────────────────────────────
  // 4. CULTIVOS
  //    Lote A: Regina (variedad tardía, mejor calibre, export premium)
  //    Lote B: Bing (variedad temprana, mercado local + export)
  // ─────────────────────────────────────────────
  const cropA = await prisma.crop.upsert({
    where: { id: "crop_curico_A_regina" },
    update: {},
    create: {
      id: "crop_curico_A_regina",
      species: "Cerezo",
      variety: "Regina",
      plantYear: 2015,
      density: 833, // 4m x 3m → ~833 plantas/ha
      rootstock: "Colt",
      lotId: lotA.id,
    },
  });

  const cropB = await prisma.crop.upsert({
    where: { id: "crop_curico_B_bing" },
    update: {},
    create: {
      id: "crop_curico_B_bing",
      species: "Cerezo",
      variety: "Bing",
      plantYear: 2013,
      density: 667, // 5m x 3m → ~667 plantas/ha (plantas más grandes, más antiguas)
      rootstock: "Mahaleb",
      lotId: lotB.id,
    },
  });
  console.log(
    `✅ Cultivos: Regina (Lote A, plantado ${cropA.plantYear}) | Bing (Lote B, plantado ${cropB.plantYear})`
  );

  // ─────────────────────────────────────────────
  // 5. CICLOS PRODUCTIVOS ACTIVOS (temporada 2024/2025)
  //    Estado: CUAJA → fruto cuajado, pasando a llenado
  //    Horas frío: Regina acumuló 847h (meta cumplida)
  //    Calibre estimado: 28-30mm (export JJ/J)
  // ─────────────────────────────────────────────
  const cycleA = await prisma.productionCycle.upsert({
    where: { id: "cycle_2024_A_regina" },
    update: {},
    create: {
      id: "cycle_2024_A_regina",
      season: "2024/2025",
      startDate: new Date("2024-08-01"),
      isActive: true,
      estadoFenologico: EstadoFenologico.CUAJA,
      horasFrioAcumuladas: 847,
      calibreEstimado: 29.5, // mm - buen calibre para export
      rendimientoEstimado: 14200, // kg/ha (temporada favorable)
      fechaCosechaEstimada: new Date("2025-01-20"),
      destinoProduccion: DestinoProduccion.EXPORTACION,
      notas:
        "Floración uniforme en octubre. Buena polinización (2 colmenas/ha). Leve estrés hídrico semana 48, corregido con riego.",
      cropId: cropA.id,
    },
  });

  const cycleB = await prisma.productionCycle.upsert({
    where: { id: "cycle_2024_B_bing" },
    update: {},
    create: {
      id: "cycle_2024_B_bing",
      season: "2024/2025",
      startDate: new Date("2024-08-01"),
      isActive: true,
      estadoFenologico: EstadoFenologico.CUAJA,
      horasFrioAcumuladas: 823,
      calibreEstimado: 27.8,
      rendimientoEstimado: 12500,
      fechaCosechaEstimada: new Date("2025-01-10"), // Bing madura antes que Regina
      destinoProduccion: DestinoProduccion.MIXTO,
      notas:
        "Variedad más sensible al calor. Monitorear calibre en enero. Destino: 60% export, 40% mercado interno.",
      cropId: cropB.id,
    },
  });
  console.log(
    `✅ Ciclos activos: Regina (${cycleA.horasFrioAcumuladas}h frío) | Bing (${cycleB.horasFrioAcumuladas}h frío)`
  );

  // ─────────────────────────────────────────────
  // 6. REGISTROS DE INSUMOS (últimas 3 semanas)
  //    Referencia: 2024-12-14 a 2025-01-04
  // ─────────────────────────────────────────────
  const inputsData = [
    // ── Semana 1 (hace 21-14 días) ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(21),
      category: InputCategory.FUNGICIDA,
      name: "Captan 80 WG",
      quantity: 15,
      unit: "kg",
      costPerUnit: 8500,
      totalCost: 127500,
      supplier: "Anasac",
      notes: "Aplicado por lluvia pronosticada, prevención podredumbre parda",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(21),
      category: InputCategory.FUNGICIDA,
      name: "Captan 80 WG",
      quantity: 12,
      unit: "kg",
      costPerUnit: 8500,
      totalCost: 102000,
      supplier: "Anasac",
      notes: "Mismo tratamiento preventivo Lote B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(18),
      category: InputCategory.FERTILIZANTE,
      name: "Nitrato de potasio (KNO₃)",
      quantity: 80,
      unit: "kg",
      costPerUnit: 1200,
      totalCost: 96000,
      supplier: "Compo Chile",
      notes: "Fertirrigación - etapa cuaja, aumenta calibre y dulzor",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(18),
      category: InputCategory.FERTILIZANTE,
      name: "Nitrato de potasio (KNO₃)",
      quantity: 65,
      unit: "kg",
      costPerUnit: 1200,
      totalCost: 78000,
      supplier: "Compo Chile",
      notes: "Fertirrigación Lote B",
    },
    // ── Semana 2 (hace 13-7 días) ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(14),
      category: InputCategory.RIEGO,
      name: "Agua riego (m³)",
      quantity: 2500,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 112500,
      supplier: "Canal Curicó",
      notes: "Riego por goteo, 500 m³/ha. Semana calurosa (28-32°C)",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(14),
      category: InputCategory.RIEGO,
      name: "Agua riego (m³)",
      quantity: 2500,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 112500,
      supplier: "Canal Curicó",
      notes: "Riego por goteo Lote B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(12),
      category: InputCategory.INSECTICIDA,
      name: "Clorpirifos 48% EC",
      quantity: 5,
      unit: "L",
      costPerUnit: 9800,
      totalCost: 49000,
      supplier: "Dow Agrosciences",
      notes: "Control mosca de la fruta, trampa detectó umbral de acción",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(9),
      category: InputCategory.FERTILIZANTE,
      name: "Calcio foliar (CaCl₂ 10%)",
      quantity: 50,
      unit: "L",
      costPerUnit: 1850,
      totalCost: 92500,
      supplier: "Yara Chile",
      notes: "Aplicación foliar previene rajado en etapa llenado",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(9),
      category: InputCategory.FERTILIZANTE,
      name: "Calcio foliar (CaCl₂ 10%)",
      quantity: 40,
      unit: "L",
      costPerUnit: 1850,
      totalCost: 74000,
      supplier: "Yara Chile",
      notes: "Aplicación foliar Lote B, prioritario por sensibilidad Bing al rajado",
    },
    // ── Semana 3 (hace 6-0 días) ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(5),
      category: InputCategory.FUNGICIDA,
      name: "Fludioxonil 25 SC",
      quantity: 8,
      unit: "L",
      costPerUnit: 32000,
      totalCost: 256000,
      supplier: "Syngenta",
      notes: "Tratamiento postcosecha preventivo, alta eficiencia en botrytis",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(3),
      category: InputCategory.RIEGO,
      name: "Agua riego (m³)",
      quantity: 2000,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 90000,
      supplier: "Canal Curicó",
      notes: "Riego estratégico previo a cosecha Bing",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(3),
      category: InputCategory.RIEGO,
      name: "Agua riego (m³)",
      quantity: 2000,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 90000,
      supplier: "Canal Curicó",
      notes: "ATENCIÓN: Reducir o suspender riego 48h antes cosecha para minimizar rajado",
    },
  ];

  for (const input of inputsData) {
    await prisma.input.create({ data: input });
  }
  console.log(`✅ ${inputsData.length} registros de insumos creados`);

  // ─────────────────────────────────────────────
  // 7. REGISTROS DE MANO DE OBRA (últimas 3 semanas)
  // ─────────────────────────────────────────────
  const laborData = [
    // Semana 1
    {
      productionCycleId: cycleA.id,
      date: daysAgo(20),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 4,
      hoursPerWorker: 8,
      totalHours: 32,
      costPerHour: 2800,
      totalCost: 89600,
      notes: "Aplicación fungicida Captan, equipo pulverizador",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(20),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 3,
      hoursPerWorker: 8,
      totalHours: 24,
      costPerHour: 2800,
      totalCost: 67200,
      notes: "Aplicación fungicida Lote B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(17),
      activity: LaborActivity.MONITOREO,
      workerCount: 2,
      hoursPerWorker: 6,
      totalHours: 12,
      costPerHour: 3200,
      totalCost: 38400,
      notes: "Conteo de frutos por ramo, estimación de calibre y carga",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(17),
      activity: LaborActivity.MONITOREO,
      workerCount: 2,
      hoursPerWorker: 6,
      totalHours: 12,
      costPerHour: 3200,
      totalCost: 38400,
      notes: "Monitoreo Lote B, colocación trampas mosca",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(15),
      activity: LaborActivity.RIEGO,
      workerCount: 2,
      hoursPerWorker: 4,
      totalHours: 8,
      costPerHour: 2500,
      totalCost: 20000,
      notes: "Supervisión y ajuste de goteros bloqueados",
    },
    // Semana 2
    {
      productionCycleId: cycleA.id,
      date: daysAgo(11),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 3,
      hoursPerWorker: 8,
      totalHours: 24,
      costPerHour: 2800,
      totalCost: 67200,
      notes: "Aplicación insecticida + calcio foliar",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(10),
      activity: LaborActivity.INSTALACION_MALLA,
      workerCount: 8,
      hoursPerWorker: 9,
      totalHours: 72,
      costPerHour: 2600,
      totalCost: 187200,
      notes: "Instalación malla antigranizo y antiluvia sobre Lote B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(8),
      activity: LaborActivity.RALEO,
      workerCount: 6,
      hoursPerWorker: 8,
      totalHours: 48,
      costPerHour: 2700,
      totalCost: 129600,
      notes: "Raleo de frutos dobles y muy pequeños para mejorar calibre final",
    },
    // Semana 3
    {
      productionCycleId: cycleA.id,
      date: daysAgo(6),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 4,
      hoursPerWorker: 7,
      totalHours: 28,
      costPerHour: 2800,
      totalCost: 78400,
      notes: "Aplicación Fludioxonil preventivo",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(4),
      activity: LaborActivity.MONITOREO,
      workerCount: 3,
      hoursPerWorker: 5,
      totalHours: 15,
      costPerHour: 3200,
      totalCost: 48000,
      notes: "Muestreo de madurez: Brix 16.2 promedio, calibre 27mm, color rojo 80%",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(2),
      activity: LaborActivity.OTRO,
      workerCount: 10,
      hoursPerWorker: 3,
      totalHours: 30,
      costPerHour: 2500,
      totalCost: 75000,
      notes: "Preparación de bins y material de cosecha, calibración balanzas",
    },
  ];

  for (const labor of laborData) {
    await prisma.laborRecord.create({ data: labor });
  }
  console.log(`✅ ${laborData.length} registros de mano de obra creados`);

  // ─────────────────────────────────────────────
  // 8. REGISTROS CLIMÁTICOS (últimas 3 semanas, diarios)
  //    Curicó, Maule: verano austral (diciembre-enero)
  //    Rango típico: 15-32°C, lluvia ocasional, viento sur
  // ─────────────────────────────────────────────
  const weatherHistory = [
    // Datos diarios: [diasAtras, tempC(media), tempMin, tempMax, precip, windKmh, humidity]
    // Semana 3 hace 21 días (mediados diciembre)
    { d: 21, tC: 22.4, tMin: 11.2, tMax: 31.8, p: 0, w: 18, h: 52 },
    { d: 20, tC: 19.8, tMin: 10.5, tMax: 28.2, p: 0, w: 22, h: 58 },
    { d: 19, tC: 17.2, tMin: 9.8, tMax: 23.5, p: 4.2, w: 15, h: 72 }, // lluvia leve
    { d: 18, tC: 18.5, tMin: 10.1, tMax: 25.8, p: 0, w: 12, h: 65 },
    { d: 17, tC: 21.3, tMin: 12.4, tMax: 30.1, p: 0, w: 20, h: 55 },
    { d: 16, tC: 24.6, tMin: 14.2, tMax: 34.5, p: 0, w: 25, h: 42 }, // calor
    { d: 15, tC: 26.1, tMin: 15.8, tMax: 35.8, p: 0, w: 28, h: 38 }, // GOLPE CALOR
    // Semana 2 (hace 14-8 días, fines diciembre)
    { d: 14, tC: 23.2, tMin: 13.5, tMax: 32.6, p: 0, w: 22, h: 45 },
    { d: 13, tC: 21.8, tMin: 12.8, tMax: 30.4, p: 0, w: 18, h: 50 },
    { d: 12, tC: 20.5, tMin: 11.9, tMax: 28.5, p: 1.8, w: 14, h: 60 },
    { d: 11, tC: 22.9, tMin: 13.2, tMax: 31.2, p: 0, w: 16, h: 48 },
    { d: 10, tC: 25.4, tMin: 14.8, tMax: 34.2, p: 0, w: 24, h: 40 }, // calor fuerte
    { d: 9, tC: 27.3, tMin: 16.1, tMax: 36.4, p: 0, w: 30, h: 35 },  // GOLPE CALOR
    { d: 8, tC: 24.8, tMin: 14.5, tMax: 33.1, p: 0, w: 26, h: 42 },
    // Semana 1 (hace 7-1 días, inicio enero 2025)
    { d: 7, tC: 22.1, tMin: 12.8, tMax: 30.5, p: 0, w: 20, h: 52 },
    { d: 6, tC: 20.8, tMin: 11.5, tMax: 29.2, p: 0, w: 15, h: 55 },
    { d: 5, tC: 23.5, tMin: 13.8, tMax: 32.4, p: 0, w: 22, h: 47 },
    { d: 4, tC: 25.9, tMin: 15.2, tMax: 35.0, p: 0, w: 27, h: 40 }, // calor
    { d: 3, tC: 28.4, tMin: 17.1, tMax: 38.2, p: 0, w: 32, h: 32 }, // ONDA DE CALOR
    { d: 2, tC: 26.7, tMin: 16.4, tMax: 36.5, p: 0, w: 28, h: 36 }, // continúa calor
    { d: 1, tC: 22.3, tMin: 13.2, tMax: 31.8, p: 2.5, w: 18, h: 58 }, // lluvia leve
  ];

  for (const w of weatherHistory) {
    const timestamp = daysAgo(w.d);
    timestamp.setHours(12, 0, 0, 0);

    const esBajoUmbralHelada = w.tMin < -1;
    const contribuyeHorasFrio = w.tC < 7;
    // Lluvia en período enero = riesgo cosecha
    const esRiesgoLluvia = w.p > 1 && w.d <= 7;

    // Evapotranspiración aproximada (Hargreaves simplificado)
    const etMm = Math.max(0, 0.0023 * (w.tC + 17.8) * Math.sqrt(w.tMax - w.tMin) * 8.5);

    await prisma.weatherLog.upsert({
      where: { farmId_timestamp: { farmId: farm.id, timestamp } },
      update: {},
      create: {
        farmId: farm.id,
        timestamp,
        tempC: w.tC,
        tempMinC: w.tMin,
        tempMaxC: w.tMax,
        precipMm: w.p,
        windSpeedKmh: w.w,
        windDirection: 185 + Math.floor(Math.random() * 30), // viento predominante del sur
        humidity: w.h,
        etMm: Math.round(etMm * 10) / 10,
        esBajoUmbralHelada,
        contribuyeHorasFrio,
        esRiesgoLluvia,
      },
    });
  }
  console.log(`✅ ${weatherHistory.length} registros climáticos creados`);

  // ─────────────────────────────────────────────
  // 9. ALERTAS (generadas por el sistema y por IA)
  // ─────────────────────────────────────────────
  const alertsData = [
    {
      farmId: farm.id,
      type: AlertType.GOLPE_CALOR,
      severity: AlertSeverity.CRITICA,
      title: "Onda de calor - Riesgo de quemadura solar en fruto",
      description:
        "Temperatura máxima alcanzó 38.2°C el 2 de enero. En estado de llenado de fruto, temperaturas sobre 35°C por más de 2 horas reducen significativamente el calibre final y pueden provocar quemaduras solares en la cara expuesta del fruto.",
      recommendation:
        "Aplicar kaolín (Surround WP) 25 kg/ha como protector solar. Activar riego por microaspersión sobre copa 2-3 veces al día entre 12:00 y 17:00h. Monitorear temperatura bajo el dosel cada 2 horas.",
      triggerValue: 38.2,
      triggerMetric: "temperatura_maxima_c",
      source: AlertSource.AUTOMATICA,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(3),
    },
    {
      farmId: farm.id,
      type: AlertType.LLUVIA_COSECHA,
      severity: AlertSeverity.ADVERTENCIA,
      title: "Lluvia detectada - Riesgo de rajado en Bing",
      description:
        "Se registraron 2.5 mm de lluvia el día 3 de enero. Con Bing próxima a cosecha (estimada 10 enero), cualquier precipitación aumenta la presión osmótica y provoca rajado del epicarpio, especialmente en calibres sobre 28mm.",
      recommendation:
        "Revisar malla antiluvia Lote B y asegurar escurrimiento. Adelantar evaluación de madurez a 5 enero. Si Brix ≥ 16.5 y color ≥ 85% rojo, considerar cosecha anticipada para evitar segunda lluvia pronosticada.",
      triggerValue: 2.5,
      triggerMetric: "precipitacion_mm",
      source: AlertSource.IA,
      isRead: true,
      isResolved: false,
      createdAt: daysAgo(1),
    },
    {
      farmId: farm.id,
      type: AlertType.GOLPE_CALOR,
      severity: AlertSeverity.ADVERTENCIA,
      title: "Temperatura crítica sostenida - Posible reducción de calibre Regina",
      description:
        "Acumulación de 4 días consecutivos sobre 34°C (semana del 27-30 diciembre). Impacto estimado en calibre final de Regina: reducción de 0.8-1.2mm respecto a proyección inicial. Calibre estimado revisado: 28.3mm (bajó de 29.5mm).",
      recommendation:
        "Aumentar dosis KNO₃ fertirrigación a 120 kg/ha en próxima aplicación. Evaluar aplicación foliar de ácido giberélico (ProGibb 40%) 15 ppm para compensar reducción de calibre. Contactar empresa empaque para ajustar proyección de volumen categoría JJ.",
      triggerValue: 36.4,
      triggerMetric: "temperatura_maxima_c",
      source: AlertSource.IA,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(5),
    },
    {
      farmId: farm.id,
      type: AlertType.GENERAL,
      severity: AlertSeverity.INFO,
      title: "Reporte semanal IA - Semana del 28 diciembre al 4 enero",
      description:
        "Estado general del predio: BUENO con observaciones. Ambos lotes completaron la etapa de cuaja con buena uniformidad. Lote A (Regina): carga estimada 14.2 t/ha, calibre proyectado 28-30mm, color en desarrollo. Lote B (Bing): carga estimada 12.5 t/ha, calibre 27-28mm, madurez avanzada. Horas frío acumuladas suficientes para ambas variedades. Principal riesgo actual: onda de calor en curso.",
      recommendation:
        "Prioridad 1: Manejo del calor (ver alerta crítica). Prioridad 2: Preparar logística cosecha Bing para semana del 6-10 enero. Prioridad 3: Contratar cuadrilla cosecha (40 personas/día, 3-4 días). Iniciar coordinación con packing.",
      source: AlertSource.IA,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(0),
    },
  ];

  for (const alert of alertsData) {
    await prisma.alert.create({ data: alert });
  }
  console.log(`✅ ${alertsData.length} alertas creadas`);

  // ─────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log("🎉 Seed completado exitosamente!\n");
  console.log("📊 Resumen del dataset:");
  console.log(`   Usuario:    ${user.name}`);
  console.log(`   Predio:     ${farm.name}, ${farm.commune}`);
  console.log(
    `   Superficie: ${farm.totalArea} ha totales (10 ha cerezos)`
  );
  console.log(
    `   Lotes:      2 × 5 ha (Regina Lote A | Bing Lote B)`
  );
  console.log(`   Temporada:  2024/2025 - Estado: CUAJA → LLENADO`);
  console.log(
    `   Insumos:    ${inputsData.length} registros`
  );
  console.log(
    `   Labor:      ${laborData.length} registros`
  );
  console.log(
    `   Clima:      ${weatherHistory.length} días (3 semanas)`
  );
  console.log(
    `   Alertas:    ${alertsData.length} (1 crítica, 2 advertencias, 1 info)`
  );
  console.log("─".repeat(50));
  console.log(
    "\n🔑 Login de prueba (Clerk): carlos.fuentes@agromind.cl"
  );
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
