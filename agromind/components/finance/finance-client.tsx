"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  Layers,
  Users,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { INPUT_CATEGORY_LABELS, LABOR_ACTIVITY_LABELS } from "@/types";
import type { InputCategory, LaborActivity } from "@prisma/client";

// ── Types matching the API response ────────────────────────
interface FinanceData {
  summary: {
    totalInputsCost: number;
    totalLaborCost: number;
    totalCost: number;
    cycleCount: number;
  };
  byCategory: { category: string; total: number }[];
  byActivity: { activity: string; total: number }[];
  monthly: { mes: string; insumos: number; manoDeObra: number; total: number }[];
  cycleSummaries: {
    id: string;
    season: string;
    variety: string;
    lotName: string;
    farmName: string;
    inputsCost: number;
    laborCost: number;
    total: number;
    costPerHa: number;
    hectareas: number;
  }[];
  topExpenses: { name: string; category: string; totalCost: number; date: Date }[];
}

// ── Formatting ─────────────────────────────────────────────
const clp = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);

// Pie chart colors
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

// ── Custom tooltip for monthly bar chart ──────────────────
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm min-w-[160px]">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{clp(p.value)}</span>
        </p>
      ))}
      <p className="border-t mt-1 pt-1 text-gray-600 font-semibold">
        Total: {clp(total)}
      </p>
    </div>
  );
}

// ── Pie tooltip ────────────────────────────────────────────
function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-medium text-gray-700">{payload[0].name}</p>
      <p className="text-gray-900 font-semibold">{clp(payload[0].value)}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export function FinanceClient() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-gray-400 py-10 text-center">No data available.</p>;

  const { summary, byCategory, byActivity, monthly, cycleSummaries, topExpenses } = data;

  const categoryPieData = byCategory.map((c) => ({
    name: INPUT_CATEGORY_LABELS[c.category as InputCategory] ?? c.category,
    value: c.total,
  }));

  const activityPieData = byActivity.map((a) => ({
    name: LABOR_ACTIVITY_LABELS[a.activity as LaborActivity] ?? a.activity,
    value: a.total,
  }));

  return (
    <div className="space-y-5">
      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-500">Total expenses</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{clp(summary.totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-gray-500">Inputs</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{clp(summary.totalInputsCost)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.totalCost > 0
                ? Math.round((summary.totalInputsCost / summary.totalCost) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-gray-500">Labor</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{clp(summary.totalLaborCost)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.totalCost > 0
                ? Math.round((summary.totalLaborCost / summary.totalCost) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-500">Active cycles</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{summary.cycleCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly bar chart ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            Monthly expenses — active season
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6b7280" }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k` : `$${v}`
                }
              />
              <Tooltip content={<MonthlyTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(v) => (v === "insumos" ? "Inputs" : "Labor")} />
              <Bar dataKey="insumos" name="insumos" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="manoDeObra" name="manoDeObra" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Pie charts row ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Input categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-emerald-500" />
              Inputs by category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryPieData.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {categoryPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Labor activities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Labor by activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityPieData.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={activityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {activityPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-cycle summary ────────────────────────────────── */}
      {cycleSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-500" />
              Summary by cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cycleSummaries.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {c.variety} — {c.lotName}
                  </p>
                  <p className="text-xs text-gray-500">{c.farmName} · {c.season}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="font-semibold text-gray-900">{clp(c.total)}</p>
                  <p className="text-xs text-gray-400">{clp(c.costPerHa)}/ha</p>
                </div>
                <div className="w-20 shrink-0">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{
                        width: `${summary.totalCost > 0 ? (c.total / summary.totalCost) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 text-right">
                    {summary.totalCost > 0 ? Math.round((c.total / summary.totalCost) * 100) : 0}%
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Top expenses ──────────────────────────────────────── */}
      {topExpenses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-gray-500" />
              Top 5 highest input expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {topExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                    <p className="text-xs text-gray-400">
                      {INPUT_CATEGORY_LABELS[e.category as InputCategory] ?? e.category}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900 shrink-0 ml-2">{clp(e.totalCost)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
