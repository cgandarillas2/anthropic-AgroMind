"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Farm, Lot, Crop, ProductionCycle } from "@prisma/client";
import Link from "next/link";

type FarmWithRelations = Farm & {
  lots: (Lot & {
    crops: (Crop & {
      productionCycles: ProductionCycle[];
    })[];
  })[];
  _count: { alerts: number };
};

interface FarmsClientProps {
  initialFarms: FarmWithRelations[];
}

const REGIONES = [
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
];

const COMUNAS_POR_REGION: Record<string, string[]> = {
  "O'Higgins": ["Rancagua", "San Fernando", "Rengo", "Pichilemu", "Santa Cruz"],
  "Maule": ["Talca", "Curicó", "Linares", "Cauquenes", "Constitución", "Molina", "Parral"],
  "Ñuble": ["Chillán", "San Carlos", "Bulnes", "Yungay"],
  "Biobío": ["Concepción", "Los Ángeles", "Chillán Viejo"],
  "La Araucanía": ["Temuco", "Villarrica", "Pucón", "Angol"],
  "Los Ríos": ["Valdivia", "La Unión", "Panguipulli"],
  "Los Lagos": ["Puerto Montt", "Osorno", "Castro"],
};

const EMPTY_FORM = {
  name: "",
  address: "",
  region: "",
  commune: "",
  latitude: "",
  longitude: "",
  totalArea: "",
};

export function FarmsClient({ initialFarms }: FarmsClientProps) {
  const router = useRouter();
  const [farms, setFarms] = useState(initialFarms);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const comunas = form.region ? (COMUNAS_POR_REGION[form.region] ?? []) : [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          region: form.region,
          commune: form.commune,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          totalArea: parseFloat(form.totalArea),
        }),
      });
      if (!res.ok) throw new Error("Error creating farm");
      const created = await res.json();
      setFarms((prev) => [{ ...created, lots: [], _count: { alerts: 0 } }, ...prev]);
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(farmId: string) {
    if (!confirm("Delete this farm? All its lots, crops and records will be deleted.")) return;
    setDeletingId(farmId);
    try {
      await fetch(`/api/farms/${farmId}`, { method: "DELETE" });
      setFarms((prev) => prev.filter((f) => f.id !== farmId));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function activeCyclesCount(farm: FarmWithRelations) {
    return farm.lots.flatMap((l) =>
      l.crops.flatMap((c) => c.productionCycles.filter((p) => p.isActive))
    ).length;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {farms.length} {farms.length === 1 ? "farm registered" : "farms registered"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-1" /> New Farm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Register Farm</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Farm Name</Label>
                  <Input
                    placeholder="Los Cerezos Farm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Address / Sector</Label>
                  <Input
                    placeholder="Camino Los Nogales s/n, sector Romeral"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Region</Label>
                  <Select
                    value={form.region}
                    onValueChange={(v) => setForm({ ...form, region: v, commune: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Commune</Label>
                  <Select
                    value={form.commune}
                    onValueChange={(v) => setForm({ ...form, commune: v })}
                    disabled={!form.region}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {comunas.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="-34.9756"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="-71.2384"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Total Area (hectares)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="12.5"
                    value={form.totalArea}
                    onChange={(e) => setForm({ ...form, totalArea: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !form.region || !form.commune}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? "Saving..." : "Create Farm"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Farm cards */}
      {farms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No farms registered</p>
            <p className="text-sm text-gray-400 mt-1">
              Add your first farm to start managing your crops.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {farms.map((farm) => {
            const cycles = activeCyclesCount(farm);
            const lotsCount = farm.lots.length;
            return (
              <Card key={farm.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{farm.name}</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {farm.commune}, {farm.region}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(farm.id)}
                      disabled={deletingId === farm.id}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-500 truncate">{farm.address}</p>

                  {/* Stats row */}
                  <div className="flex gap-3 text-xs">
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {farm.totalArea} ha
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {lotsCount} {lotsCount === 1 ? "lot" : "lots"}
                    </span>
                    {cycles > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {cycles} {cycles === 1 ? "active cycle" : "active cycles"}
                      </Badge>
                    )}
                  </div>

                  {/* Coordinates */}
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}
                  </p>

                  {/* Link to detail */}
                  <Link
                    href={`/farms/${farm.id}`}
                    className="flex items-center justify-between text-sm text-green-600 hover:text-green-700 font-medium pt-1 border-t"
                  >
                    View Details
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
