"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { IOT_DEVICE_TYPE_LABELS, IOT_DEVICE_TYPE_ICONS } from "@/types";
import type { IoTDeviceType } from "@/types";

const DEVICE_TYPES = Object.entries(IOT_DEVICE_TYPE_LABELS) as [IoTDeviceType, string][];

interface Lot {
  id: string;
  name: string;
}

interface Props {
  farmLat: number;
  farmLng: number;
  lots: Lot[];
  onCreated: (device: object) => void;
}

export function AddDeviceDialog({ farmLat, farmLng, lots, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "WEATHER_STATION" as IoTDeviceType,
    latitude: farmLat.toFixed(4),
    longitude: farmLng.toFixed(4),
    lotId: "",
    serialNumber: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/iot/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          lotId: form.lotId || null,
          serialNumber: form.serialNumber || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create device");
      const device = await res.json();
      onCreated(device);
      setOpen(false);
      setForm({
        name: "",
        type: "WEATHER_STATION",
        latitude: farmLat.toFixed(4),
        longitude: farmLng.toFixed(4),
        lotId: "",
        serialNumber: "",
        notes: "",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Add Device
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Register IoT Device</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Device name *</Label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. WS-A2 Weather Station"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Device type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {DEVICE_TYPES.map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                    form.type === type
                      ? "border-green-500 bg-green-50 text-green-700 font-medium"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <span>{IOT_DEVICE_TYPE_ICONS[type]}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lot */}
          {lots.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="lot">Lot (optional)</Label>
              <select
                id="lot"
                value={form.lotId}
                onChange={(e) => setForm((f) => ({ ...f, lotId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— No specific lot —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude *</Label>
              <input
                id="lat"
                type="number"
                step="0.0001"
                required
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude *</Label>
              <input
                id="lng"
                type="number"
                step="0.0001"
                required
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Tip: use GPS coordinates from your phone at the device location
          </p>

          {/* Serial number */}
          <div className="space-y-1.5">
            <Label htmlFor="serial">Serial number (optional)</Label>
            <input
              id="serial"
              value={form.serialNumber}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
              placeholder="e.g. DAVIS-7210-A2"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Location details, mounting height, etc."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? "Saving…" : "Register device"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
