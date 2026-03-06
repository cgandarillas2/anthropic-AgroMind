"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Wifi, WifiOff, Wrench, Trash2, Battery, BatteryLow,
  MapPin, Clock, Activity, Cpu
} from "lucide-react";
import { AddDeviceDialog } from "@/components/iot/add-device-dialog";
import {
  IOT_DEVICE_TYPE_LABELS,
  IOT_DEVICE_TYPE_ICONS,
  IOT_DEVICE_STATUS_STYLES,
} from "@/types";
import type { IoTDeviceWithReadings } from "@/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// Dynamic import to disable SSR for Leaflet map
const FarmMap = dynamic(
  () => import("@/components/iot/farm-map").then((m) => m.FarmMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-gray-200 bg-gray-50 h-[360px] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    ),
  }
);

interface Farm {
  id: string;
  name: string;
  commune: string;
  latitude: number;
  longitude: number;
  lots: { id: string; name: string }[];
}

interface Props {
  farm: Farm;
  initialDevices: IoTDeviceWithReadings[];
}

// Get latest value per metric from a device's readings
function getLatestReadings(readings: IoTDeviceWithReadings["readings"]) {
  const latest: Record<string, { value: number; unit: string; timestamp: Date }> = {};
  for (const r of readings) {
    const ts = new Date(r.timestamp);
    if (!latest[r.metric] || ts > new Date(latest[r.metric].timestamp)) {
      latest[r.metric] = { value: r.value, unit: r.unit, timestamp: ts };
    }
  }
  return latest;
}

// Format metric key into a readable label
function formatMetricLabel(metric: string) {
  return metric
    .replace(/_c$/i, " °C")
    .replace(/_pct$|_pct_\d+cm$/i, " %")
    .replace(/_kmh$/i, " km/h")
    .replace(/_mm$/i, " mm")
    .replace(/_/g, " ");
}

// Status icon
function StatusIcon({ status }: { status: string }) {
  if (status === "ONLINE") return <Wifi className="w-3.5 h-3.5 text-green-500" />;
  if (status === "OFFLINE") return <WifiOff className="w-3.5 h-3.5 text-red-500" />;
  return <Wrench className="w-3.5 h-3.5 text-yellow-500" />;
}

export function IoTClient({ farm, initialDevices }: Props) {
  const [devices, setDevices] = useState<IoTDeviceWithReadings[]>(initialDevices);
  const [selectedDevice, setSelectedDevice] = useState<IoTDeviceWithReadings | null>(null);
  const [chartReadings, setChartReadings] = useState<{ timestamp: string; value: number }[]>([]);
  const [chartMetric, setChartMetric] = useState<string | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onlineCount = devices.filter((d) => d.status === "ONLINE").length;
  const offlineCount = devices.filter((d) => d.status === "OFFLINE").length;
  const maintenanceCount = devices.filter((d) => d.status === "MAINTENANCE").length;

  const handleDeviceCreated = useCallback((device: object) => {
    setDevices((prev) => [...prev, device as IoTDeviceWithReadings]);
  }, []);

  async function handleDelete(deviceId: string) {
    if (!confirm("Delete this device and all its readings?")) return;
    setDeletingId(deviceId);
    try {
      await fetch(`/api/iot/devices/${deviceId}`, { method: "DELETE" });
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) setSelectedDevice(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function loadChart(deviceId: string, metric: string) {
    if (chartMetric === metric && selectedDevice?.id === deviceId) {
      setChartMetric(null);
      return;
    }
    setLoadingChart(true);
    setChartMetric(metric);
    try {
      const res = await fetch(`/api/iot/readings?deviceId=${deviceId}&metric=${metric}&hours=168`); // 7 days
      const data = await res.json();
      setChartReadings(
        data.map((r: { timestamp: string; value: number }) => ({
          timestamp: format(new Date(r.timestamp), "d/M HH:mm"),
          value: Math.round(r.value * 10) / 10,
        }))
      );
    } finally {
      setLoadingChart(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-500">Total devices</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="h-4 w-4 text-green-500" />
              <p className="text-xs text-gray-500">Online</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{onlineCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <WifiOff className="h-4 w-4 text-red-500" />
              <p className="text-xs text-gray-500">Offline</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{offlineCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-yellow-500" />
              <p className="text-xs text-gray-500">Maintenance</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{maintenanceCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            Field Map — {farm.name}
            <span className="text-xs font-normal text-gray-400">{farm.commune}</span>
          </h2>
          <AddDeviceDialog
            farmLat={farm.latitude}
            farmLng={farm.longitude}
            lots={farm.lots}
            onCreated={handleDeviceCreated}
          />
        </div>
        <FarmMap
          farmLat={farm.latitude}
          farmLng={farm.longitude}
          farmName={farm.name}
          devices={devices}
        />
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Online</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Offline</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />Maintenance</span>
          <span className="flex items-center gap-1.5"><span className="text-base">🏡</span>Farm center</span>
        </div>
      </div>

      <Separator />

      {/* Device list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          Registered Devices
        </h2>

        {devices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Cpu className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No devices registered</p>
            <p className="text-sm mt-1">Add your first IoT sensor using the button above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => {
              const latestReadings = getLatestReadings(device.readings);
              const statusStyle = IOT_DEVICE_STATUS_STYLES[device.status];
              const isSelected = selectedDevice?.id === device.id;
              const batteryLow = device.batteryPct != null && device.batteryPct < 20;

              return (
                <Card
                  key={device.id}
                  className={`transition-shadow cursor-pointer ${isSelected ? "ring-2 ring-green-500" : "hover:shadow-md"}`}
                  onClick={() => setSelectedDevice(isSelected ? null : device)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{IOT_DEVICE_TYPE_ICONS[device.type]}</span>
                        <div>
                          <CardTitle className="text-sm font-semibold text-gray-900">
                            {device.name}
                          </CardTitle>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {IOT_DEVICE_TYPE_LABELS[device.type]}
                            {device.lot && ` · ${device.lot.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusStyle.badge}`}>
                          <StatusIcon status={device.status} />
                          {statusStyle.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(device.id); }}
                          disabled={deletingId === device.id}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {/* Latest readings */}
                    {Object.keys(latestReadings).length > 0 ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(latestReadings)
                          .slice(0, 4)
                          .map(([metric, { value, unit }]) => (
                            <button
                              key={metric}
                              onClick={(e) => { e.stopPropagation(); loadChart(device.id, metric); setSelectedDevice(device); }}
                              className={`text-left rounded-lg p-2 transition-colors ${
                                chartMetric === metric && selectedDevice?.id === device.id
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-gray-50 hover:bg-gray-100"
                              }`}
                            >
                              <div className="text-xs text-gray-400 truncate">
                                {formatMetricLabel(metric)}
                              </div>
                              <div className="font-bold text-sm text-gray-800">
                                {value.toFixed(1)}{unit}
                              </div>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-2 text-center">No readings yet</p>
                    )}

                    {/* Footer: battery + last seen */}
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t">
                      <div className="flex items-center gap-1">
                        {batteryLow ? (
                          <BatteryLow className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Battery className="w-3.5 h-3.5" />
                        )}
                        <span className={batteryLow ? "text-red-500 font-medium" : ""}>
                          {device.batteryPct != null ? `${device.batteryPct}%` : "—"}
                          {batteryLow && " ⚠️"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {device.lastSeenAt
                          ? format(new Date(device.lastSeenAt), "MMM d, HH:mm", { locale: enUS })
                          : "Never"}
                      </div>
                    </div>

                    {/* Serial number */}
                    {device.serialNumber && (
                      <p className="text-xs text-gray-300">SN: {device.serialNumber}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reading history chart */}
      {selectedDevice && chartMetric && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              {selectedDevice.name} — {formatMetricLabel(chartMetric)}
              <Badge variant="outline" className="text-xs font-normal">Last 7 days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingChart ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                Loading data…
              </div>
            ) : chartReadings.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                No data available for this metric
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartReadings} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    name={formatMetricLabel(chartMetric)}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Click any reading value to view its history
            </p>
          </CardContent>
        </Card>
      )}

      {/* API endpoint hint */}
      <Card className="border-dashed bg-gray-50">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">📡 Device ingestion endpoint</p>
          <code className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 block">
            POST /api/iot/readings
          </code>
          <pre className="text-xs text-gray-500 mt-2 bg-white border border-gray-100 rounded p-2 overflow-x-auto">
{`{ "deviceId": "...", "metric": "temperature_c",
  "value": 22.5, "unit": "°C" }`}
          </pre>
          <p className="text-xs text-gray-400 mt-1">
            Your physical devices (ESP32, Raspberry Pi, etc.) POST to this endpoint to record readings.
            Alerts are triggered automatically on threshold breaches.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
