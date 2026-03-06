"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useRouter } from "next/navigation";
import type { LaborRecord, ProductionCycle, Crop, Lot } from "@prisma/client";
import { LABOR_ACTIVITY_LABELS } from "@/types";

type CycleWithRelations = ProductionCycle & { crop: Crop & { lot: Lot } };

interface Props {
  records: LaborRecord[];
  cycles: CycleWithRelations[];
}

const ACTIVITY_ICONS: Record<string, string> = {
  PRUNING: "✂️", THINNING: "🍒", PESTICIDE_APPLICATION: "💊",
  IRRIGATION: "💧", FERTILIZATION: "🌱", HARVEST: "🧺",
  PACKING: "📦", MONITORING: "🔍", NETTING_INSTALLATION: "🕸️", OTHER: "⚙️",
};

export function LaborClient({ records: initial, cycles }: Props) {
  const [records, setRecords] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    productionCycleId: cycles[0]?.id ?? "",
    date: new Date().toISOString().split("T")[0],
    activity: "MONITORING",
    workerCount: "",
    hoursPerWorker: "8",
    costPerHour: "2800",
    notes: "",
  });

  const totalCost = records.reduce((s, r) => s + r.totalCost, 0);
  const totalHours = records.reduce((s, r) => s + r.totalHours, 0);

  const estimatedTotal =
    form.workerCount && form.hoursPerWorker && form.costPerHour
      ? Number(form.workerCount) * Number(form.hoursPerWorker) * Number(form.costPerHour)
      : null;

  async function handleAdd() {
    if (!form.workerCount || !form.hoursPerWorker || !form.costPerHour) return;
    setLoading(true);
    try {
      const res = await fetch("/api/labor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          workerCount: Number(form.workerCount),
          hoursPerWorker: Number(form.hoursPerWorker),
          costPerHour: Number(form.costPerHour),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRecords((p) => [created, ...p]);
        setOpen(false);
        setForm((f) => ({ ...f, workerCount: "", notes: "" }));
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setRecords((p) => p.filter((r) => r.id !== id));
    await fetch(`/api/labor?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-blue-600 font-medium">Total labor</div>
            <div className="text-2xl font-bold text-blue-800 mt-1">
              ${(totalCost / 1_000_000).toFixed(3)}M
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-400 font-medium">Total hours</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              {totalHours.toLocaleString("es-CL")}h
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-400 font-medium">Average cost/hour</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              ${totalHours > 0 ? Math.round(totalCost / totalHours).toLocaleString("es-CL") : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4" /> Labor records
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Activity</th>
                  <th className="text-left pb-2 font-medium">Lot</th>
                  <th className="text-right pb-2 font-medium">Workers</th>
                  <th className="text-right pb-2 font-medium">Hours</th>
                  <th className="text-right pb-2 font-medium">Total cost</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      No records. Add the first workday.
                    </td>
                  </tr>
                )}
                {records.map((rec) => {
                  const cycle = cycles.find((c) => c.id === rec.productionCycleId);
                  return (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 text-xs">
                        {format(rec.date, "d MMM", { locale: enUS })}
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-1.5">
                          <span>{ACTIVITY_ICONS[rec.activity] ?? "⚙️"}</span>
                          <span className="text-gray-800 font-medium">
                            {LABOR_ACTIVITY_LABELS[rec.activity]}
                          </span>
                        </span>
                        {rec.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{rec.notes}</p>
                        )}
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {cycle ? `${cycle.crop.variety} · ${cycle.crop.lot.name}` : "—"}
                      </td>
                      <td className="py-2 text-right text-gray-700">
                        {rec.workerCount} workers
                      </td>
                      <td className="py-2 text-right text-gray-700">
                        {rec.totalHours}h
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-800">
                        ${rec.totalCost.toLocaleString("es-CL")}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold text-gray-700">
                    <td colSpan={4} className="pt-2 text-xs text-right">Total</td>
                    <td className="pt-2 text-right">{totalHours}h</td>
                    <td className="pt-2 text-right">${totalCost.toLocaleString("es-CL")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register workday</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cycle / Lot</Label>
                <Select value={form.productionCycleId} onValueChange={(v) => setForm((f) => ({ ...f, productionCycleId: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.crop.variety} · {c.crop.lot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Activity</Label>
              <Select value={form.activity} onValueChange={(v) => setForm((f) => ({ ...f, activity: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LABOR_ACTIVITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{ACTIVITY_ICONS[k]} {v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs"># workers</Label>
                <Input type="number" className="mt-1 h-8 text-sm" placeholder="0"
                  value={form.workerCount} onChange={(e) => setForm((f) => ({ ...f, workerCount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Hours/worker</Label>
                <Input type="number" className="mt-1 h-8 text-sm"
                  value={form.hoursPerWorker} onChange={(e) => setForm((f) => ({ ...f, hoursPerWorker: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">CLP/hour</Label>
                <Input type="number" className="mt-1 h-8 text-sm"
                  value={form.costPerHour} onChange={(e) => setForm((f) => ({ ...f, costPerHour: e.target.value }))} />
              </div>
            </div>

            {estimatedTotal !== null && (
              <p className="text-xs text-blue-600 font-medium">
                Estimated total: ${estimatedTotal.toLocaleString("es-CL")} CLP
                ({Number(form.workerCount) * Number(form.hoursPerWorker)}h total)
              </p>
            )}

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="Workday description"
                value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={loading || !form.workerCount}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
