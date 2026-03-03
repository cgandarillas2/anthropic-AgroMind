import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get all active production cycles for the user
  const cycles = await db.productionCycle.findMany({
    where: {
      isActive: true,
      crop: { lot: { farm: { ownerId: user.id } } },
    },
    include: {
      inputs: true,
      laborRecords: true,
      crop: {
        include: {
          lot: { include: { farm: true } },
        },
      },
    },
  });

  // ── Totals ──────────────────────────────────────────────
  const totalInputsCost = cycles.flatMap((c) => c.inputs).reduce((s, i) => s + i.totalCost, 0);
  const totalLaborCost = cycles.flatMap((c) => c.laborRecords).reduce((s, l) => s + l.totalCost, 0);
  const totalCost = totalInputsCost + totalLaborCost;

  // ── By category (inputs) ─────────────────────────────────
  const byCategory: Record<string, number> = {};
  for (const cycle of cycles) {
    for (const input of cycle.inputs) {
      byCategory[input.category] = (byCategory[input.category] ?? 0) + input.totalCost;
    }
  }

  // ── By labor activity ─────────────────────────────────────
  const byActivity: Record<string, number> = {};
  for (const cycle of cycles) {
    for (const labor of cycle.laborRecords) {
      byActivity[labor.activity] = (byActivity[labor.activity] ?? 0) + labor.totalCost;
    }
  }

  // ── Monthly breakdown (from earliest cycle start → today, max 8 months) ──
  const today = new Date();

  // Find the earliest startDate across all active cycles
  const earliestStart = cycles.reduce<Date | null>((min, c) => {
    const d = new Date(c.startDate);
    return min === null || d < min ? d : min;
  }, null) ?? subMonths(today, 5);

  // Build monthly buckets from that start month through the current month
  const monthsToShow: Date[] = [];
  let cursor = startOfMonth(earliestStart);
  const endCursor = startOfMonth(today);
  while (cursor <= endCursor && monthsToShow.length < 8) {
    monthsToShow.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const monthly = monthsToShow.map((ref) => {
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    const label = format(ref, "MMM yy", { locale: es });

    let insumos = 0;
    let manoDeObra = 0;
    for (const cycle of cycles) {
      for (const input of cycle.inputs) {
        const d = new Date(input.date);
        if (d >= start && d <= end) insumos += input.totalCost;
      }
      for (const labor of cycle.laborRecords) {
        const d = new Date(labor.date);
        if (d >= start && d <= end) manoDeObra += labor.totalCost;
      }
    }
    return { mes: label, insumos, manoDeObra, total: insumos + manoDeObra };
  });

  // ── Per-cycle summary ─────────────────────────────────────
  const cycleSummaries = cycles.map((cycle) => {
    const inputsCost = cycle.inputs.reduce((s, i) => s + i.totalCost, 0);
    const laborCost = cycle.laborRecords.reduce((s, l) => s + l.totalCost, 0);
    const totalHectareas = cycle.crop.lot.area;
    const total = inputsCost + laborCost;
    return {
      id: cycle.id,
      season: cycle.season,
      variety: cycle.crop.variety,
      lotName: cycle.crop.lot.name,
      farmName: cycle.crop.lot.farm.name,
      inputsCost,
      laborCost,
      total,
      costPerHa: totalHectareas > 0 ? Math.round(total / totalHectareas) : 0,
      hectareas: totalHectareas,
    };
  });

  // ── Largest single expenses ───────────────────────────────
  const allInputs = cycles.flatMap((c) =>
    c.inputs.map((i) => ({
      name: i.name,
      category: i.category,
      totalCost: i.totalCost,
      date: i.date,
    }))
  );
  const topExpenses = [...allInputs]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  return NextResponse.json({
    summary: {
      totalInputsCost,
      totalLaborCost,
      totalCost,
      cycleCount: cycles.length,
    },
    byCategory: Object.entries(byCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    byActivity: Object.entries(byActivity)
      .map(([activity, total]) => ({ activity, total }))
      .sort((a, b) => b.total - a.total),
    monthly,
    cycleSummaries,
    topExpenses,
  });
}
