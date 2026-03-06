/**
 * AgroMind - Seed Script
 *
 * Test data: Cherry farm in Curicó, Maule Region.
 * 2 lots of 5 ha each, Regina (Lot A) and Bing (Lot B).
 *
 * BASE_DATE is dynamic (today), so the data is always coherent
 * with the current date. In March, cherries are in POST_HARVEST.
 *
 * 2025/2026 season:
 *  - Dormancy: Jun-Aug 2025
 *  - Flowering: Oct 2025
 *  - Fruit set: Nov 2025
 *  - Fruit fill: Dec 2025 - Jan 2026
 *  - Harvest Bing: Dec 28, 2025
 *  - Harvest Regina: Jan 15, 2026
 *  - Current stage: POST_HARVEST (Feb-Mar 2026)
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PhenologicalStage,
  ProductionDestination,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
  IoTDeviceType,
  IoTDeviceStatus,
} from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Base dates: always relative to TODAY ───────────────────────────
const BASE_DATE = new Date(); // today, dynamic
BASE_DATE.setHours(12, 0, 0, 0);

const daysAgo = (d: number) =>
  new Date(BASE_DATE.getTime() - d * 24 * 60 * 60 * 1000);

// Fixed past dates for key events in the 2025/2026 season
const SEASON_START   = new Date("2025-08-01"); // cycle start (dormancy)
const HARVEST_BING   = new Date("2025-12-28"); // Bing harvest (early variety)
const HARVEST_REGINA = new Date("2026-01-15"); // Regina harvest (late variety)

async function main() {
  console.log("🌱 Starting AgroMind seed...\n");
  console.log(`📅 Base date (today): ${BASE_DATE.toLocaleDateString("en-US")}\n`);

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
  // 2. FARM - Los Nogales Farm, Curicó
  // ─────────────────────────────────────────────
  const farm = await prisma.farm.upsert({
    where: { id: "farm_curico_001" },
    update: {},
    create: {
      id: "farm_curico_001",
      name: "Los Nogales Farm",
      address: "Los Nogales Road s/n, Romeral sector",
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
  //    Lot A: Regina (late variety, best caliber, premium export)
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
  // 5. ACTIVE PRODUCTION CYCLES (2025/2026 season)
  //    Current stage: POST_HARVEST (Feb-Mar 2026)
  //    Harvest completed:
  //      - Bing: December 28, 2025
  //      - Regina: January 15, 2026
  //    Chill hours met: 847h (Regina) / 823h (Bing)
  //    Achieved caliber: 29.8mm (Regina) / 27.5mm (Bing)
  // ─────────────────────────────────────────────
  const cycleA = await prisma.productionCycle.upsert({
    where: { id: "cycle_2025_A_regina" },
    update: {},
    create: {
      id: "cycle_2025_A_regina",
      season: "2025/2026",
      startDate: SEASON_START,
      isActive: true,
      phenologicalStage: PhenologicalStage.POST_HARVEST,
      chillHoursAccumulated: 847,
      estimatedCalibration: 29.8, // mm — final achieved caliber
      estimatedYield: 13800, // kg/ha — final yield
      estimatedHarvestDate: HARVEST_REGINA, // Jan 15, 2026 (completed)
      productionDestination: ProductionDestination.EXPORT,
      notes:
        "2025/2026 season completed successfully. Harvest Jan 15, 2026: 13.8 t/ha, 78% JJ/J export caliber. Minor cracking due to Jan 12 rain (3.2mm) — covered by netting. Post-harvest pruning to begin in March.",
      cropId: cropA.id,
    },
  });

  const cycleB = await prisma.productionCycle.upsert({
    where: { id: "cycle_2025_B_bing" },
    update: {},
    create: {
      id: "cycle_2025_B_bing",
      season: "2025/2026",
      startDate: SEASON_START,
      isActive: true,
      phenologicalStage: PhenologicalStage.POST_HARVEST,
      chillHoursAccumulated: 823,
      estimatedCalibration: 27.5, // mm — final achieved caliber
      estimatedYield: 12100, // kg/ha — final yield
      estimatedHarvestDate: HARVEST_BING, // Dec 28, 2025 (completed)
      productionDestination: ProductionDestination.MIXED,
      notes:
        "2025/2026 season. Harvest Dec 28, 2025: 12.1 t/ha, 64% export (60% J, 4% JJ), 36% domestic market. Heat wave in Dec (3 days >36°C) reduced caliber 0.5mm vs projection. Planning: increase rain cover in Dec for next season.",
      cropId: cropB.id,
    },
  });
  console.log(
    `✅ Active cycles (POST_HARVEST): Regina harvested ${HARVEST_REGINA.toLocaleDateString("en-US")} | Bing harvested ${HARVEST_BING.toLocaleDateString("en-US")}`
  );

  // ─────────────────────────────────────────────
  // 6. INPUT RECORDS (last 3 weeks — post-harvest management)
  //    Reference period: mid-Feb to early-Mar 2026
  //    Focus: post-harvest fertilization, disease control, pruning prep
  // ─────────────────────────────────────────────
  const inputsData = [
    // ── Week 1 (21-14 days ago) — early post-harvest ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(21),
      category: InputCategory.FUNGICIDE,
      name: "Fludioxonil 25 SC (Switch)",
      quantity: 6,
      unit: "L",
      costPerUnit: 32000,
      totalCost: 192000,
      supplier: "Syngenta",
      notes: "Post-harvest wound treatment after pruning cuts — botrytis and Monilinia prevention",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(21),
      category: InputCategory.FUNGICIDE,
      name: "Fludioxonil 25 SC (Switch)",
      quantity: 5,
      unit: "L",
      costPerUnit: 32000,
      totalCost: 160000,
      supplier: "Syngenta",
      notes: "Post-harvest fungicide application Lot B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(18),
      category: InputCategory.FERTILIZER,
      name: "Zinc sulfate (ZnSO₄ 21%)",
      quantity: 30,
      unit: "kg",
      costPerUnit: 1400,
      totalCost: 42000,
      supplier: "Compo Chile",
      notes: "Post-harvest foliar zinc — promotes flower bud differentiation for next season",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(18),
      category: InputCategory.FERTILIZER,
      name: "Zinc sulfate (ZnSO₄ 21%)",
      quantity: 25,
      unit: "kg",
      costPerUnit: 1400,
      totalCost: 35000,
      supplier: "Compo Chile",
      notes: "Post-harvest foliar zinc Lot B",
    },
    // ── Week 2 (13-7 days ago) — recovery fertilization ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(14),
      category: InputCategory.FERTILIZER,
      name: "Urea 46%",
      quantity: 120,
      unit: "kg",
      costPerUnit: 620,
      totalCost: 74400,
      supplier: "Yara Chile",
      notes: "Post-harvest nitrogen fertigation — restores tree reserves after heavy crop load",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(14),
      category: InputCategory.FERTILIZER,
      name: "Urea 46%",
      quantity: 100,
      unit: "kg",
      costPerUnit: 620,
      totalCost: 62000,
      supplier: "Yara Chile",
      notes: "Post-harvest nitrogen fertigation Lot B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(11),
      category: InputCategory.IRRIGATION,
      name: "Irrigation water (m³)",
      quantity: 1800,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 81000,
      supplier: "Canal Curicó",
      notes: "Post-harvest irrigation to support foliar recovery and nutrient uptake",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(11),
      category: InputCategory.IRRIGATION,
      name: "Irrigation water (m³)",
      quantity: 1800,
      unit: "m³",
      costPerUnit: 45,
      totalCost: 81000,
      supplier: "Canal Curicó",
      notes: "Post-harvest irrigation Lot B",
    },
    // ── Week 3 (6-0 days ago) — pruning and next season prep ──
    {
      productionCycleId: cycleA.id,
      date: daysAgo(6),
      category: InputCategory.FERTILIZER,
      name: "Boron (Solubor 20.5%)",
      quantity: 12,
      unit: "kg",
      costPerUnit: 4200,
      totalCost: 50400,
      supplier: "Agrotec",
      notes: "Foliar boron — critical for next season flower bud viability and pollen tube growth",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(6),
      category: InputCategory.FERTILIZER,
      name: "Boron (Solubor 20.5%)",
      quantity: 10,
      unit: "kg",
      costPerUnit: 4200,
      totalCost: 42000,
      supplier: "Agrotec",
      notes: "Foliar boron Lot B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(3),
      category: InputCategory.FUNGICIDE,
      name: "Copper hydroxide (Kocide 35 WG)",
      quantity: 25,
      unit: "kg",
      costPerUnit: 3800,
      totalCost: 95000,
      supplier: "DuPont Chile",
      notes: "Dormant copper spray — controls bacterial canker and wood diseases pre-pruning",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(3),
      category: InputCategory.FUNGICIDE,
      name: "Copper hydroxide (Kocide 35 WG)",
      quantity: 20,
      unit: "kg",
      costPerUnit: 3800,
      totalCost: 76000,
      supplier: "DuPont Chile",
      notes: "Dormant copper spray Lot B",
    },
  ];

  for (const input of inputsData) {
    await prisma.input.create({ data: input });
  }
  console.log(`✅ ${inputsData.length} input records created`);

  // ─────────────────────────────────────────────
  // 7. LABOR RECORDS (last 3 weeks — post-harvest activities)
  // ─────────────────────────────────────────────
  const laborData = [
    // Week 1 — wound treatment and foliar applications
    {
      productionCycleId: cycleA.id,
      date: daysAgo(20),
      activity: LaborActivity.PESTICIDE_APPLICATION,
      workerCount: 4,
      hoursPerWorker: 8,
      totalHours: 32,
      costPerHour: 2800,
      totalCost: 89600,
      notes: "Post-harvest fungicide application + foliar zinc, Lot A (5 ha)",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(20),
      activity: LaborActivity.PESTICIDE_APPLICATION,
      workerCount: 4,
      hoursPerWorker: 8,
      totalHours: 32,
      costPerHour: 2800,
      totalCost: 89600,
      notes: "Post-harvest fungicide application + foliar zinc, Lot B (5 ha)",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(17),
      activity: LaborActivity.MONITORING,
      workerCount: 2,
      hoursPerWorker: 6,
      totalHours: 12,
      costPerHour: 3200,
      totalCost: 38400,
      notes: "Post-harvest damage assessment: sunburn evaluation, wood disease inspection, canker mapping",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(17),
      activity: LaborActivity.MONITORING,
      workerCount: 2,
      hoursPerWorker: 5,
      totalHours: 10,
      costPerHour: 3200,
      totalCost: 32000,
      notes: "Lot B damage assessment — Bing more affected by Dec heat wave, mapping weak wood zones",
    },
    // Week 2 — pruning starts
    {
      productionCycleId: cycleA.id,
      date: daysAgo(13),
      activity: LaborActivity.IRRIGATION,
      workerCount: 2,
      hoursPerWorker: 4,
      totalHours: 8,
      costPerHour: 2500,
      totalCost: 20000,
      notes: "Fertigation setup adjustment for urea application — dripper inspection",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(10),
      activity: LaborActivity.PRUNING,
      workerCount: 8,
      hoursPerWorker: 9,
      totalHours: 72,
      costPerHour: 3500,
      totalCost: 252000,
      notes: "Post-harvest summer pruning Lot A — removal of water sprouts, crossing branches, epicormic growth",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(9),
      activity: LaborActivity.PRUNING,
      workerCount: 8,
      hoursPerWorker: 9,
      totalHours: 72,
      costPerHour: 3500,
      totalCost: 252000,
      notes: "Post-harvest summer pruning Lot B — also removing heat-damaged wood identified in monitoring",
    },
    // Week 3 — copper spray and next season planning
    {
      productionCycleId: cycleA.id,
      date: daysAgo(5),
      activity: LaborActivity.PESTICIDE_APPLICATION,
      workerCount: 3,
      hoursPerWorker: 8,
      totalHours: 24,
      costPerHour: 2800,
      totalCost: 67200,
      notes: "Copper hydroxide + boron foliar application after pruning",
    },
    {
      productionCycleId: cycleB.id,
      date: daysAgo(5),
      activity: LaborActivity.PESTICIDE_APPLICATION,
      workerCount: 3,
      hoursPerWorker: 8,
      totalHours: 24,
      costPerHour: 2800,
      totalCost: 67200,
      notes: "Copper + boron application Lot B",
    },
    {
      productionCycleId: cycleA.id,
      date: daysAgo(2),
      activity: LaborActivity.MONITORING,
      workerCount: 2,
      hoursPerWorker: 4,
      totalHours: 8,
      costPerHour: 3200,
      totalCost: 25600,
      notes: "Leaf analysis sampling — sent to lab for N, P, K, Zn, B levels. Results expected in 10 days.",
    },
  ];

  for (const labor of laborData) {
    await prisma.laborRecord.create({ data: labor });
  }
  console.log(`✅ ${laborData.length} labor records created`);

  // ─────────────────────────────────────────────
  // 8. WEATHER RECORDS (last 3 weeks)
  //    Curicó, Maule: late summer / early autumn (Feb-Mar)
  //    Typical: 15-28°C, some rain possible, humidity rising
  // ─────────────────────────────────────────────
  const weatherHistory = [
    // [daysAgo, avgTempC, tempMin, tempMax, precipMm, windKmh, humidity]
    // Week 3 (21 days ago — mid Feb 2026)
    { d: 21, tC: 22.1, tMin: 12.4, tMax: 30.5, p: 0,   w: 16, h: 48 },
    { d: 20, tC: 21.3, tMin: 11.8, tMax: 29.2, p: 0,   w: 18, h: 52 },
    { d: 19, tC: 19.5, tMin: 10.2, tMax: 26.8, p: 5.2, w: 12, h: 70 }, // light rain
    { d: 18, tC: 18.8, tMin: 10.5, tMax: 25.4, p: 2.1, w: 10, h: 74 }, // rain continues
    { d: 17, tC: 20.4, tMin: 11.3, tMax: 28.0, p: 0,   w: 14, h: 62 },
    { d: 16, tC: 23.2, tMin: 13.1, tMax: 31.4, p: 0,   w: 22, h: 50 },
    { d: 15, tC: 24.8, tMin: 14.2, tMax: 32.8, p: 0,   w: 26, h: 44 }, // warm day
    // Week 2 (14-8 days ago — late Feb 2026)
    { d: 14, tC: 22.5, tMin: 12.8, tMax: 30.1, p: 0,   w: 20, h: 50 },
    { d: 13, tC: 20.9, tMin: 11.5, tMax: 28.4, p: 0,   w: 16, h: 55 },
    { d: 12, tC: 19.2, tMin: 10.8, tMax: 26.2, p: 8.4, w: 11, h: 78 }, // significant rain
    { d: 11, tC: 17.5, tMin:  9.2, tMax: 24.1, p: 3.6, w:  9, h: 82 }, // rain
    { d: 10, tC: 19.8, tMin: 10.4, tMax: 27.5, p: 0,   w: 14, h: 65 },
    { d:  9, tC: 21.4, tMin: 11.9, tMax: 29.2, p: 0,   w: 18, h: 58 },
    { d:  8, tC: 20.2, tMin: 11.2, tMax: 28.0, p: 0,   w: 15, h: 60 },
    // Week 1 (7-1 days ago — early Mar 2026)
    { d:  7, tC: 18.8, tMin: 10.1, tMax: 26.4, p: 0,   w: 12, h: 62 },
    { d:  6, tC: 19.5, tMin: 10.8, tMax: 27.1, p: 0,   w: 14, h: 60 },
    { d:  5, tC: 17.4, tMin:  9.5, tMax: 24.2, p: 4.8, w: 10, h: 75 }, // rain — autumn approaching
    { d:  4, tC: 16.8, tMin:  8.8, tMax: 23.5, p: 9.2, w:  8, h: 80 }, // moderate rain
    { d:  3, tC: 18.2, tMin:  9.6, tMax: 25.4, p: 0,   w: 13, h: 68 },
    { d:  2, tC: 20.1, tMin: 10.5, tMax: 27.8, p: 0,   w: 17, h: 55 },
    { d:  1, tC: 19.6, tMin: 10.2, tMax: 26.9, p: 0,   w: 15, h: 57 },
  ];

  for (const w of weatherHistory) {
    const timestamp = daysAgo(w.d);
    timestamp.setHours(12, 0, 0, 0);

    const isBelowFrostThreshold = w.tMin < -1;
    const contributesToChillHours = w.tC < 7;
    // In post-harvest period, rain is less critical (no fruit on tree)
    const isRainRisk = w.p > 5 && w.d <= 7;

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
        windDirection: 185 + Math.floor(Math.random() * 30),
        humidity: w.h,
        etMm: Math.round(etMm * 10) / 10,
        isBelowFrostThreshold,
        contributesToChillHours,
        isRainRisk,
      },
    });
  }
  console.log(`✅ ${weatherHistory.length} weather records created`);

  // ─────────────────────────────────────────────
  // 9. ALERTS (post-harvest management and next season planning)
  // ─────────────────────────────────────────────
  const alertsData = [
    {
      farmId: farm.id,
      type: AlertType.GENERAL,
      severity: AlertSeverity.WARNING,
      title: "Leaf analysis pending — adjust post-harvest fertilization",
      description:
        "Samples sent to lab on March 2nd. Lot B showed visual symptoms of zinc deficiency during final fruit fill (Dec 2025). Expected results in 10 days. Fertilization plan for next season should be adjusted based on results.",
      recommendation:
        "While waiting for lab results, continue foliar zinc applications (ZnSO₄ 30 kg/ha). If lab confirms deficiency, apply additional soil zinc chelate (EDTA) 15 kg/ha in April before dormancy sets in.",
      source: AlertSource.AI,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(2),
    },
    {
      farmId: farm.id,
      type: AlertType.GENERAL,
      severity: AlertSeverity.INFO,
      title: "Post-harvest pruning completion — 90% done",
      description:
        "Summer pruning completed on both lots (Feb 23-24, 2026). Lot A (Regina): good canopy structure, minimal corrective work needed. Lot B (Bing): removed 15% more wood than planned due to heat-damaged and crossing branches. Tree skeleton in good condition for next season.",
      recommendation:
        "Complete wound sealing on Bing cuts >3cm with copper-based paste (Arbocel or similar). Schedule dormancy pruning for June 2026 to finalize canopy structure. Document removed wood volume for carbon tracking.",
      source: AlertSource.AI,
      isRead: true,
      isResolved: false,
      createdAt: daysAgo(5),
    },
    {
      farmId: farm.id,
      type: AlertType.GENERAL,
      severity: AlertSeverity.CRITICAL,
      title: "Dormancy preparation — chill hour accumulation window opens in May",
      description:
        "Target: 800h below 7°C for both Regina and Bing. Chill accumulation season begins May 2026 in Curicó. Last season: Regina reached 847h, Bing 823h (both adequate). Weather forecast indicates a warmer-than-normal autumn (El Niño influence) — chill hour target may be at risk.",
      recommendation:
        "Plan evaporative cooling application (hydrogen cyanamide 0.5-1%) for late July if chill hour deficit exceeds 150h. Confirm dormancy-break protocol with agronomist by June 15. Monitor min temperatures from May 1 with automatic station.",
      source: AlertSource.AI,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(0),
    },
    {
      farmId: farm.id,
      type: AlertType.GENERAL,
      severity: AlertSeverity.INFO,
      title: "Season 2025/2026 final report — results above target",
      description:
        "Season closed successfully. Regina Lot A: 13.8 t/ha (target 14 t/ha), 78% export JJ/J, income ~$42M CLP/ha. Bing Lot B: 12.1 t/ha (target 12 t/ha), 64% export, income ~$28M CLP/ha. Heat wave in December reduced Bing caliber by 0.5mm vs projection. Rain netting on Lot B proved effective (cracking <2%).",
      recommendation:
        "Key improvements for 2026/2027: (1) Install rain cover on Lot A (Regina) before December harvest. (2) Add over-canopy cooling system for Bing in heat event protocol. (3) Increase Bing rain netting coverage to 100% vs current 70%.",
      source: AlertSource.AI,
      isRead: false,
      isResolved: false,
      createdAt: daysAgo(7),
    },
  ];

  for (const alert of alertsData) {
    await prisma.alert.create({ data: alert });
  }
  console.log(`✅ ${alertsData.length} alerts created`);

  // ─────────────────────────────────────────────
  // 10. IoT DEVICES
  //     5 sensors deployed across the two lots
  //     Farm center: -34.9756, -71.2384 (Curicó)
  // ─────────────────────────────────────────────
  const devicesData = [
    {
      id: "iot_ws_lot_a",
      name: "WS-A1 Weather Station",
      type: IoTDeviceType.WEATHER_STATION,
      status: IoTDeviceStatus.ONLINE,
      latitude: -34.9733,
      longitude: -71.2390,
      batteryPct: 82,
      serialNumber: "DAVIS-7210-A1",
      notes: "Davis Vantage Pro2 station — northwest corner of Lot A",
      lastSeenAt: daysAgo(0),
      farmId: farm.id,
      lotId: lotA.id,
    },
    {
      id: "iot_ws_lot_b",
      name: "WS-B1 Weather Station",
      type: IoTDeviceType.WEATHER_STATION,
      status: IoTDeviceStatus.ONLINE,
      latitude: -34.9780,
      longitude: -71.2377,
      batteryPct: 91,
      serialNumber: "DAVIS-7210-B1",
      notes: "Davis Vantage Pro2 station — southeast sector of Lot B",
      lastSeenAt: daysAgo(0),
      farmId: farm.id,
      lotId: lotB.id,
    },
    {
      id: "iot_sm_lot_a",
      name: "SM-A1 Soil Moisture",
      type: IoTDeviceType.SOIL_MOISTURE,
      status: IoTDeviceStatus.ONLINE,
      latitude: -34.9741,
      longitude: -71.2381,
      batteryPct: 68,
      serialNumber: "SENTEK-ENVIROScan-A1",
      notes: "Sentek EnviroScan, 3 depths (20/40/60cm) — row 5, between irrigation lines",
      lastSeenAt: daysAgo(0),
      farmId: farm.id,
      lotId: lotA.id,
    },
    {
      id: "iot_sm_lot_b",
      name: "SM-B1 Soil Moisture",
      type: IoTDeviceType.SOIL_MOISTURE,
      status: IoTDeviceStatus.OFFLINE,
      latitude: -34.9774,
      longitude: -71.2388,
      batteryPct: 12,
      serialNumber: "SENTEK-ENVIROScan-B1",
      notes: "Sentek EnviroScan — Lot B, row 8. Battery low — needs replacement",
      lastSeenAt: daysAgo(3),
      farmId: farm.id,
      lotId: lotB.id,
    },
    {
      id: "iot_frost_lot_a",
      name: "FS-A1 Frost Sensor",
      type: IoTDeviceType.FROST_SENSOR,
      status: IoTDeviceStatus.ONLINE,
      latitude: -34.9745,
      longitude: -71.2395,
      batteryPct: 76,
      serialNumber: "ADCON-T60-A1",
      notes: "Adcon T60 canopy-level frost sensor — low depression point in Lot A (most frost-prone zone)",
      lastSeenAt: daysAgo(0),
      farmId: farm.id,
      lotId: lotA.id,
    },
  ];

  const devices: Record<string, { id: string }> = {};
  for (const d of devicesData) {
    const device = await prisma.ioTDevice.upsert({
      where: { id: d.id },
      update: { status: d.status, batteryPct: d.batteryPct, lastSeenAt: d.lastSeenAt },
      create: d,
    });
    devices[d.id] = device;
  }
  console.log(`✅ ${devicesData.length} IoT devices created`);

  // ─────────────────────────────────────────────
  // 11. IoT READINGS (last 21 days — 4 readings/day each device)
  // ─────────────────────────────────────────────
  const readingHours = [7, 12, 18, 23]; // morning, noon, afternoon, night
  let totalReadings = 0;

  for (let day = 21; day >= 0; day--) {
    for (const hour of readingHours) {
      const ts = daysAgo(day);
      ts.setHours(hour, 0, 0, 0);

      // Temperature varies by hour and day (summer→autumn trend)
      const baseTempC = 22 - day * 0.08; // slow cooling as autumn approaches
      const hourFactor = hour === 7 ? -5 : hour === 12 ? 4 : hour === 18 ? 2 : -6;
      const noise = (Math.random() - 0.5) * 2;
      const tempC = Math.round((baseTempC + hourFactor + noise) * 10) / 10;
      const humidityPct = Math.round(65 + (hour === 7 ? 15 : hour === 12 ? -10 : hour === 18 ? -5 : 20) + (Math.random() - 0.5) * 10);
      const windKmh = Math.round(8 + Math.random() * 14);

      // WS-A1: full weather station readings
      await prisma.ioTReading.createMany({
        data: [
          { deviceId: "iot_ws_lot_a", metric: "temperature_c", value: tempC, unit: "°C", timestamp: ts },
          { deviceId: "iot_ws_lot_a", metric: "humidity_pct", value: Math.min(95, humidityPct), unit: "%", timestamp: ts },
          { deviceId: "iot_ws_lot_a", metric: "wind_speed_kmh", value: windKmh, unit: "km/h", timestamp: ts },
        ],
      });

      // WS-B1: Lot B is slightly warmer (south-facing, lower elevation)
      await prisma.ioTReading.createMany({
        data: [
          { deviceId: "iot_ws_lot_b", metric: "temperature_c", value: Math.round((tempC + 0.8 + (Math.random() - 0.5)) * 10) / 10, unit: "°C", timestamp: ts },
          { deviceId: "iot_ws_lot_b", metric: "humidity_pct", value: Math.min(95, humidityPct - 3 + Math.round((Math.random() - 0.5) * 6)), unit: "%", timestamp: ts },
        ],
      });

      // SM-A1: Soil moisture — 3 depths (online)
      const smBase = 38 + day * 0.2; // gets slightly drier as we approach today
      await prisma.ioTReading.createMany({
        data: [
          { deviceId: "iot_sm_lot_a", metric: "soil_moisture_20cm_pct", value: Math.round((smBase + (Math.random() - 0.5) * 4) * 10) / 10, unit: "%", timestamp: ts },
          { deviceId: "iot_sm_lot_a", metric: "soil_moisture_40cm_pct", value: Math.round((smBase + 6 + (Math.random() - 0.5) * 3) * 10) / 10, unit: "%", timestamp: ts },
          { deviceId: "iot_sm_lot_a", metric: "soil_moisture_60cm_pct", value: Math.round((smBase + 10 + (Math.random() - 0.5) * 2) * 10) / 10, unit: "%", timestamp: ts },
        ],
      });

      // SM-B1: offline after day 3 — only data for days 21..4
      if (day >= 4) {
        await prisma.ioTReading.createMany({
          data: [
            { deviceId: "iot_sm_lot_b", metric: "soil_moisture_20cm_pct", value: Math.round((32 + (Math.random() - 0.5) * 5) * 10) / 10, unit: "%", timestamp: ts },
            { deviceId: "iot_sm_lot_b", metric: "soil_moisture_40cm_pct", value: Math.round((38 + (Math.random() - 0.5) * 4) * 10) / 10, unit: "%", timestamp: ts },
          ],
        });
      }

      // FS-A1: Frost sensor — canopy level (typically 1-2°C colder than ambient at night)
      const frostTempC = hour === 23 || hour === 7 ? tempC - 2.2 + (Math.random() - 0.5) * 1.5 : tempC - 0.5;
      await prisma.ioTReading.create({
        data: { deviceId: "iot_frost_lot_a", metric: "temperature_c", value: Math.round(frostTempC * 10) / 10, unit: "°C", timestamp: ts },
      });

      totalReadings += 3 + 2 + 3 + (day >= 4 ? 2 : 0) + 1;
    }
  }
  console.log(`✅ ~${totalReadings} IoT readings created`);

  // ─────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────
  console.log("\n" + "─".repeat(55));
  console.log("🎉 Seed completed successfully!\n");
  console.log("📊 Dataset summary:");
  console.log(`   User:    ${user.name}`);
  console.log(`   Farm:    ${farm.name}, ${farm.commune}`);
  console.log(`   Area:    ${farm.totalArea} ha total (10 ha cherries)`);
  console.log(`   Lots:    2 × 5 ha (Regina Lot A | Bing Lot B)`);
  console.log(`   Season:  2025/2026 — Stage: POST_HARVEST (Feb-Mar 2026)`);
  console.log(`   Harvest: Regina Jan 15, 2026 | Bing Dec 28, 2025`);
  console.log(`   Inputs:  ${inputsData.length} records`);
  console.log(`   Labor:   ${laborData.length} records`);
  console.log(`   Weather: ${weatherHistory.length} days (3 weeks, ending today)`);
  console.log(`   Alerts:  ${alertsData.length} (1 critical, 1 warning, 2 info)`);
  console.log(`   IoT:     ${devicesData.length} devices (2 WS, 2 Soil, 1 Frost) · ~${totalReadings} readings`);
  console.log("─".repeat(55));
  console.log("\n🔑 Test login (Clerk): carlos.fuentes@agromind.cl");
}

main()
  .catch((e) => {
    console.error("❌ Error in seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
