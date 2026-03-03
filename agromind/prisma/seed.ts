/**
 * AgroMind - Seed Script
 *
 * Test data: Cherry farm in Curicó, Maule Region.
 * 2 lots of 5 ha each, Regina variety, active cycle in
 * "CUAJA" (fruit set) stage, with records from the last 3 weeks.
 *
 * Seed reference date: 2025-01-04 (2024/2025 season)
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

// ─── Base dates (3 weeks ago from 2025-01-04) ───
const BASE_DATE = new Date("2025-01-04T12:00:00-03:00");
const daysAgo = (d: number) =>
  new Date(BASE_DATE.getTime() - d * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 Starting AgroMind seed...\n");

  // ─────────────────────────────────────────────
  // 1. OWNER USER
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
  console.log(`✅ User created: ${user.name}`);

  // ─────────────────────────────────────────────
  // 2. FARM - Fundo Los Ciruelos, Curicó
  //    Real coordinates: south of Curicó (~34.97°S, 71.23°W)
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
      totalArea: 12.5, // 10 ha cherries + 2.5 ha infrastructure/windbreaks
      ownerId: user.id,
    },
  });
  console.log(`✅ Farm created: ${farm.name} (${farm.commune})`);

  // ─────────────────────────────────────────────
  // 3. LOTS
  // ─────────────────────────────────────────────
  const lotA = await prisma.lot.upsert({
    where: { id: "lot_curico_A" },
    update: {},
    create: {
      id: "lot_curico_A",
      name: "Lot A - North Sector",
      area: 5.0,
      soilType: "Clayey silty loam",
      slopePerc: 3.5,
      farmId: farm.id,
    },
  });

  const lotB = await prisma.lot.upsert({
    where: { id: "lot_curico_B" },
    update: {},
    create: {
      id: "lot_curico_B",
      name: "Lot B - South Sector",
      area: 5.0,
      soilType: "Sandy loam",
      slopePerc: 2.0,
      farmId: farm.id,
    },
  });
  console.log(`✅ Lots created: ${lotA.name} and ${lotB.name}`);

  // ─────────────────────────────────────────────
  // 4. CROPS
  //    Lot A: Regina (late variety, better caliber, premium export)
  //    Lot B: Bing (early variety, local market + export)
  // ─────────────────────────────────────────────
  const cropA = await prisma.crop.upsert({
    where: { id: "crop_curico_A_regina" },
    update: {},
    create: {
      id: "crop_curico_A_regina",
      species: "Cherry",
      variety: "Regina",
      plantYear: 2015,
      density: 833, // 4m x 3m → ~833 plants/ha
      rootstock: "Colt",
      lotId: lotA.id,
    },
  });

  const cropB = await prisma.crop.upsert({
    where: { id: "crop_curico_B_bing" },
    update: {},
    create: {
      id: "crop_curico_B_bing",
      species: "Cherry",
      variety: "Bing",
      plantYear: 2013,
      density: 667, // 5m x 3m → ~667 plants/ha (larger, older plants)
      rootstock: "Mahaleb",
      lotId: lotB.id,
    },
  });
  console.log(
    `✅ Crops: Regina (Lot A, planted ${cropA.plantYear}) | Bing (Lot B, planted ${cropB.plantYear})`
  );

  // ─────────────────────────────────────────────
  // 5. ACTIVE PRODUCTION CYCLES (2024/2025 season)
  //    Stage: CUAJA → fruit set, moving to filling
  //    Chill hours: Regina accumulated 847h (target met)
  //    Estimated caliber: 28-30mm (export JJ/J)
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
      calibreEstimado: 29.5, // mm - good caliber for export
      rendimientoEstimado: 14200, // kg/ha (favorable season)
      fechaCosechaEstimada: new Date("2025-01-20"),
      destinoProduccion: DestinoProduccion.EXPORTACION,
      notas:
        "Uniform flowering in October. Good pollination (2 hives/ha). Mild water stress week 48, corrected with irrigation.",
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
      fechaCosechaEstimada: new Date("2025-01-10"), // Bing ripens before Regina
      destinoProduccion: DestinoProduccion.MIXTO,
      notas:
        "Variety more sensitive to heat. Monitor caliber in January. Destination: 60% export, 40% domestic market.",
      cropId: cropB.id,
    },
  });
  console.log(
    `✅ Active cycles: Regina (${cycleA.horasFrioAcumuladas}h chill) | Bing (${cycleB.horasFrioAcumuladas}h chill)`
  );

  // ─────────────────────────────────────────────
  // 6. INPUT RECORDS (last 3 weeks)
  //    Reference: 2024-12-14 to 2025-01-04
  // ─────────────────────────────────────────────
  const inputsData = [
    // ── Week 1 (21-14 days ago) ──
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
      notes: "Applied due to forecast rain, brown rot prevention",
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
      notes: "Same preventive treatment Lot B",
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
      notes: "Fertigation - fruit set stage, increases caliber and sweetness",
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
      notes: "Fertigation Lot B",
    },
    // ── Week 2 (13-7 days ago) ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(14),
      category: InputCategory.RIEGO,
      name: "Irrigation water (m³)",
      quantity: 2500,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 112500,
      supplier: "Canal Curicó",
      notes: "Drip irrigation, 500 m³/ha. Hot week (28-32°C)",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(14),
      category: InputCategory.RIEGO,
      name: "Irrigation water (m³)",
      quantity: 2500,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 112500,
      supplier: "Canal Curicó",
      notes: "Drip irrigation Lot B",
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
      notes: "Fruit fly control, trap detected action threshold",
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
      notes: "Foliar application prevents cracking during filling stage",
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
      notes: "Foliar application Lot B, priority due to Bing sensitivity to cracking",
    },
    // ── Week 3 (6-0 days ago) ──
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
      notes: "Preventive post-harvest treatment, high efficiency against botrytis",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(3),
      category: InputCategory.RIEGO,
      name: "Irrigation water (m³)",
      quantity: 2000,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 90000,
      supplier: "Canal Curicó",
      notes: "Strategic irrigation before Bing harvest",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(3),
      category: InputCategory.RIEGO,
      name: "Irrigation water (m³)",
      quantity: 2000,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 90000,
      supplier: "Canal Curicó",
      notes: "ATTENTION: Reduce or suspend irrigation 48h before harvest to minimize cracking",
    },
  ];

  for (const input of inputsData) {
    await prisma.input.create({ data: input });
  }
  console.log(`✅ ${inputsData.length} input records created`);

  // ─────────────────────────────────────────────
  // 7. LABOR RECORDS (last 3 weeks)
  // ─────────────────────────────────────────────
  const laborData = [
    // Week 1
    {
      productionCycleId: cycleA.id,
      date: daysAgo(20),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 4,
      hoursPerWorker: 8,
      totalHours: 32,
      costPerHour: 2800,
      totalCost: 89600,
      notes: "Captan fungicide application, sprayer equipment",
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
      notes: "Fungicide application Lot B",
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
      notes: "Fruit count per branch, caliber and load estimation",
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
      notes: "Lot B monitoring, fly trap placement",
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
      notes: "Supervision and adjustment of blocked drippers",
    },
    // Week 2
    {
      productionCycleId: cycleA.id,
      date: daysAgo(11),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 3,
      hoursPerWorker: 8,
      totalHours: 24,
      costPerHour: 2800,
      totalCost: 67200,
      notes: "Insecticide + foliar calcium application",
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
      notes: "Hail and rain netting installation over Lot B",
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
      notes: "Thinning of double and very small fruits to improve final caliber",
    },
    // Week 3
    {
      productionCycleId: cycleA.id,
      date: daysAgo(6),
      activity: LaborActivity.APLICACION_FITOSANITARIA,
      workerCount: 4,
      hoursPerWorker: 7,
      totalHours: 28,
      costPerHour: 2800,
      totalCost: 78400,
      notes: "Preventive Fludioxonil application",
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
      notes: "Maturity sampling: average Brix 16.2, caliber 27mm, 80% red color",
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
      notes: "Preparation of bins and harvest material, scale calibration",
    },
  ];

  for (const labor of laborData) {
    await prisma.laborRecord.create({ data: labor });
  }
  console.log(`✅ ${laborData.length} labor records created`);

  // ─────────────────────────────────────────────
  // 8. WEATHER RECORDS (last 3 weeks, daily)
  //    Curicó, Maule: austral summer (December-January)
  //    Typical range: 15-32°C, occasional rain, southern wind
  // ─────────────────────────────────────────────
  const weatherHistory = [
    // Daily data: [daysAgo, avgTempC, tempMin, tempMax, precip, windKmh, humidity]
    // Week 3 21 days ago (mid December)
    { d: 21, tC: 22.4, tMin: 11.2, tMax: 31.8, p: 0, w: 18, h: 52 },
    { d: 20, tC: 19.8, tMin: 10.5, tMax: 28.2, p: 0, w: 22, h: 58 },
    { d: 19, tC: 17.2, tMin: 9.8, tMax: 23.5, p: 4.2, w: 15, h: 72 }, // light rain
    { d: 18, tC: 18.5, tMin: 10.1, tMax: 25.8, p: 0, w: 12, h: 65 },
    { d: 17, tC: 21.3, tMin: 12.4, tMax: 30.1, p: 0, w: 20, h: 55 },
    { d: 16, tC: 24.6, tMin: 14.2, tMax: 34.5, p: 0, w: 25, h: 42 }, // heat
    { d: 15, tC: 26.1, tMin: 15.8, tMax: 35.8, p: 0, w: 28, h: 38 }, // HEAT STRESS
    // Week 2 (14-8 days ago, late December)
    { d: 14, tC: 23.2, tMin: 13.5, tMax: 32.6, p: 0, w: 22, h: 45 },
    { d: 13, tC: 21.8, tMin: 12.8, tMax: 30.4, p: 0, w: 18, h: 50 },
    { d: 12, tC: 20.5, tMin: 11.9, tMax: 28.5, p: 1.8, w: 14, h: 60 },
    { d: 11, tC: 22.9, tMin: 13.2, tMax: 31.2, p: 0, w: 16, h: 48 },
    { d: 10, tC: 25.4, tMin: 14.8, tMax: 34.2, p: 0, w: 24, h: 40 }, // strong heat
    { d: 9, tC: 27.3, tMin: 16.1, tMax: 36.4, p: 0, w: 30, h: 35 },  // HEAT STRESS
    { d: 8, tC: 24.8, tMin: 14.5, tMax: 33.1, p: 0, w: 26, h: 42 },
    // Week 1 (7-1 days ago, early January 2025)
    { d: 7, tC: 22.1, tMin: 12.8, tMax: 30.5, p: 0, w: 20, h: 52 },
    { d: 6, tC: 20.8, tMin: 11.5, tMax: 29.2, p: 0, w: 15, h: 55 },
    { d: 5, tC: 23.5, tMin: 13.8, tMax: 32.4, p: 0, w: 22, h: 47 },
    { d: 4, tC: 25.9, tMin: 15.2, tMax: 35.0, p: 0, w: 27, h: 40 }, // heat
    { d: 3, tC: 28.4, tMin: 17.1, tMax: 38.2, p: 0, w: 32, h: 32 }, // HEAT WAVE
    { d: 2, tC: 26.7, tMin: 16.4, tMax: 36.5, p: 0, w: 28, h: 36 }, // heat continues
    { d: 1, tC: 22.3, tMin: 13.2, tMax: 31.8, p: 2.5, w: 18, h: 58 }, // light rain
  ];

  for (const w of weatherHistory) {
    const timestamp = daysAgo(w.d);
    timestamp.setHours(12, 0, 0, 0);

    const esBajoUmbralHelada = w.tMin < -1;
    const contribuyeHorasFrio = w.tC < 7;
    // Rain in January period = harvest risk
    const esRiesgoLluvia = w.p > 1 && w.d <= 7;

    // Approximate evapotranspiration (simplified Hargreaves)
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
  console.log(`✅ ${weatherHistory.length} weather records created`);

  // ─────────────────────────────────────────────
  // 9. ALERTS (generated by system and AI)
  // ─────────────────────────────────────────────
  const alertsData = [
    {
      farmId: farm.id,
      type: AlertType.GOLPE_CALOR,
      severity: AlertSeverity.CRITICA,
      title: "Heat wave - Risk of sunburn on fruit",
      description:
        "Maximum temperature reached 38.2°C on January 2nd. During fruit filling stage, temperatures above 35°C for more than 2 hours significantly reduce final caliber and can cause sunburn on the exposed face of the fruit.",
      recommendation:
        "Apply kaolin (Surround WP) 25 kg/ha as sun protector. Activate micro-sprinkler irrigation over canopy 2-3 times daily between 12:00 PM and 5:00 PM. Monitor temperature under canopy every 2 hours.",
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
      title: "Rain detected - Risk of cracking in Bing",
      description:
        "2.5 mm of rain were recorded on January 3rd. With Bing close to harvest (estimated Jan 10), any precipitation increases osmotic pressure and causes cracking of the epicarp, especially in calibers over 28mm.",
      recommendation:
        "Check rain netting on Lot B and ensure runoff. Advance maturity evaluation to Jan 5. If Brix ≥ 16.5 and color ≥ 85% red, consider early harvest to avoid second forecast rain.",
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
      title: "Sustained critical temperature - Possible reduction in Regina caliber",
      description:
        "Accumulation of 4 consecutive days above 34°C (week of Dec 27-30). Estimated impact on Regina final caliber: reduction of 0.8-1.2mm from initial projection. Revised estimated caliber: 28.3mm (down from 29.5mm).",
      recommendation:
        "Increase KNO₃ fertigation dose to 120 kg/ha in next application. Evaluate foliar application of gibberellic acid (ProGibb 40%) 15 ppm to compensate caliber reduction. Contact packing company to adjust JJ category volume projection.",
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
      title: "AI weekly report - Week of Dec 28 to Jan 4",
      description:
        "General farm status: GOOD with observations. Both lots completed fruit set stage with good uniformity. Lot A (Regina): estimated load 14.2 t/ha, projected caliber 28-30mm, color developing. Lot B (Bing): estimated load 12.5 t/ha, caliber 27-28mm, advanced maturity. Sufficient accumulated chill hours for both varieties. Main current risk: ongoing heat wave.",
      recommendation:
        "Priority 1: Heat management (see critical alert). Priority 2: Prepare Bing harvest logistics for week of Jan 6-10. Priority 3: Hire harvest crew (40 people/day, 3-4 days). Start coordination with packing.",
      source: AlertSource.IA,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(0),
    },
  ];

  for (const alert of alertsData) {
    await prisma.alert.create({ data: alert });
  }
  console.log(`✅ ${alertsData.length} alerts created`);

  // ─────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log("🎉 Seed completed successfully!\n");
  console.log("📊 Dataset summary:");
  console.log(`   User:    ${user.name}`);
  console.log(`   Farm:     ${farm.name}, ${farm.commune}`);
  console.log(
    `   Area: ${farm.totalArea} ha total (10 ha cherries)`
  );
  console.log(
    `   Lots:      2 × 5 ha (Regina Lot A | Bing Lot B)`
  );
  console.log(`   Season:  2024/2025 - Stage: CUAJA → FILLING`);
  console.log(
    `   Inputs:    ${inputsData.length} records`
  );
  console.log(
    `   Labor:      ${laborData.length} records`
  );
  console.log(
    `   Weather:      ${weatherHistory.length} days (3 weeks)`
  );
  console.log(
    `   Alerts:    ${alertsData.length} (1 critical, 2 warnings, 1 info)`
  );
  console.log("─".repeat(50));
  console.log(
    "\n🔑 Test login (Clerk): carlos.fuentes@agromind.cl"
  );
}

main()
  .catch((e) => {
    console.error("❌ Error in seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
