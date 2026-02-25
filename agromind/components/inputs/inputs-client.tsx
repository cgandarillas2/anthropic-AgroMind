"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import type { Input as InputRecord, ProductionCycle, Crop, Lot } from "@prisma/client";
import { INPUT_CATEGORY_LABELS } from "@/types";

type CycleWithRelations = ProductionCycle & { crop: Crop & { lot: Lot } };

interface Props {
  inputs: InputRecord[];
  cycles: CycleWithRelations[];
}

const CATEGORY_COLORS: Record<string, string> = {
  FERTILIZANTE: "bg-green-100 text-green-700",
  HERBICIDA:    "bg-yellow-100 text-yellow-700",
  FUNGICIDA:    "bg-purple-100 text-purple-700",
  INSECTICIDA:  "bg-red-100 text-red-700",
  RIEGO:        "bg-blue-100 text-blue-700",
  MATERIAL_VEGETAL: "bg-emerald-100 text-emerald-700",
  OTRO:         "bg-gray-100 text-gray-600",
};

export function InputsClient({ inputs: initial, cycles }: Props) {
  const [inputs, setInputs] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    productionCycleId: cycles[0]?.id ?? "",
    date: new Date().toISOString().split("T")[0],
    category: "FERTILIZANTE",
    name: "",
    quantity: "",
    unit: "kg",
    costPerUnit: "",
    supplier: "",
    notes: "",
  });

  const totalCost = inputs.reduce((s, i) => s + i.totalCost, 0);
  const byCat = inputs.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + i.totalCost;
    return acc;
  }, {});

  async function handleAdd() {
    if (!form.name || !form.quantity || !form.costPerUnit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          costPerUnit: Number(form.costPerUnit),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setInputs((p) => [created, ...p]);
        setOpen(false);
        setForm((f) => ({ ...f, name: "", quantity: "", costPerUnit: "", supplier: "", notes: "" }));
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setInputs((p) => p.filter((i) => i.id !== id));
    await fetch(`/api/inputs?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Resumen por categoría */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="col-span-2 md:col-span-1 bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-emerald-600 font-medium">Total insumos</div>
            <div className="text-2xl font-bold text-emerald-800 mt-1">
              ${(totalCost / 1_000_000).toFixed(3)}M
            </div>
            <div className="text-xs text-emerald-500">{inputs.length} registros</div>
          </CardContent>
        </Card>
        {Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat, cost]) => (
            <Card key={cat}>
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 font-medium">
                  {INPUT_CATEGORY_LABELS[cat as keyof typeof INPUT_CATEGORY_LABELS]}
                </div>
                <div className="text-lg font-bold text-gray-800 mt-1">
                  ${(cost / 1000).toFixed(0)}k
                </div>
                <div className="text-xs text-gray-400">
                  {((cost / totalCost) * 100).toFixed(0)}% del total
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Registros de insumos
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Agregar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 font-medium">Fecha</th>
                  <th className="text-left pb-2 font-medium">Producto</th>
                  <th className="text-left pb-2 font-medium">Categoría</th>
                  <th className="text-left pb-2 font-medium">Lote</th>
                  <th className="text-right pb-2 font-medium">Cantidad</th>
                  <th className="text-right pb-2 font-medium">Costo total</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inputs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      Sin registros. Agrega el primer insumo.
                    </td>
                  </tr>
                )}
                {inputs.map((inp) => {
                  const cycle = cycles.find((c) => c.id === inp.productionCycleId);
                  return (
                    <tr key={inp.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 text-xs">
                        {format(inp.date, "d MMM", { locale: es })}
                      </td>
                      <td className="py-2">
                        <div className="font-medium text-gray-800">{inp.name}</div>
                        {inp.supplier && (
                          <div className="text-xs text-gray-400">{inp.supplier}</div>
                        )}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[inp.category]}`}>
                          {INPUT_CATEGORY_LABELS[inp.category]}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {cycle ? `${cycle.crop.variety} · ${cycle.crop.lot.name}` : "—"}
                      </td>
                      <td className="py-2 text-right text-gray-700">
                        {inp.quantity} {inp.unit}
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-800">
                        ${inp.totalCost.toLocaleString("es-CL")}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDelete(inp.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {inputs.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold text-gray-700">
                    <td colSpan={5} className="pt-2 text-xs text-right">Total</td>
                    <td className="pt-2 text-right">${totalCost.toLocaleString("es-CL")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog agregar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar insumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ciclo / Lote</Label>
                <Select value={form.productionCycleId} onValueChange={(v) => setForm((f) => ({ ...f, productionCycleId: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                <Label className="text-xs">Fecha</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INPUT_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Nombre del producto</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="Ej: Nitrato de potasio"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" className="mt-1 h-8 text-sm" placeholder="0"
                  value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Unidad</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["kg","L","unidad","m³","bolsa","caja"].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Costo por unidad (CLP)</Label>
              <Input type="number" className="mt-1 h-8 text-sm" placeholder="0"
                value={form.costPerUnit} onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))} />
              {form.quantity && form.costPerUnit && (
                <p className="text-xs text-emerald-600 mt-1">
                  Total: ${(Number(form.quantity) * Number(form.costPerUnit)).toLocaleString("es-CL")} CLP
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Proveedor (opcional)</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="Ej: Anasac"
                value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={loading || !form.name}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
