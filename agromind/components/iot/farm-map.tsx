"use client";

// Leaflet must be loaded client-side only (no SSR)
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, ScaleControl } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import type { IoTDeviceWithReadings, IoTDeviceType, IoTDeviceStatus } from "@/types";
import { IOT_DEVICE_TYPE_ICONS, IOT_DEVICE_TYPE_LABELS, IOT_DEVICE_STATUS_STYLES } from "@/types";

// Leaflet default icon fix for Next.js (webpack issue with images)
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Create a colored div icon for each device status
function createDeviceIcon(type: IoTDeviceType, status: IoTDeviceStatus) {
  const emoji = IOT_DEVICE_TYPE_ICONS[type];
  const colors: Record<IoTDeviceStatus, string> = {
    ONLINE:      "#22c55e", // green-500
    OFFLINE:     "#ef4444", // red-500
    MAINTENANCE: "#eab308", // yellow-500
  };
  const bgColor = colors[status];

  return L.divIcon({
    className: "",
    html: `
      <div style="
        background: ${bgColor};
        border: 3px solid white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">${emoji}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// Get latest value per metric from readings array
function getLatestReadings(readings: IoTDeviceWithReadings["readings"]) {
  const latest: Record<string, { value: number; unit: string; timestamp: Date }> = {};
  for (const r of readings) {
    if (!latest[r.metric] || r.timestamp > latest[r.metric].timestamp) {
      latest[r.metric] = { value: r.value, unit: r.unit, timestamp: r.timestamp };
    }
  }
  return latest;
}

interface FarmMapProps {
  farmLat: number;
  farmLng: number;
  farmName: string;
  devices: IoTDeviceWithReadings[];
}

export function FarmMap({ farmLat, farmLng, farmName, devices }: FarmMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer
        center={[farmLat, farmLng]}
        zoom={15}
        style={{ height: "360px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ScaleControl position="bottomleft" />

        {/* Farm center marker */}
        <Marker
          position={[farmLat, farmLng]}
          icon={L.divIcon({
            className: "",
            html: `<div style="
              background: #1d4ed8;
              border: 3px solid white;
              border-radius: 4px;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">🏡</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -18],
          })}
        >
          <Popup>
            <div>
              <div className="text-sm font-semibold">{farmName}</div>
              <div className="text-xs text-gray-500">Farm center</div>
            </div>
          </Popup>
        </Marker>

        {/* IoT device markers */}
        {devices.map((device) => {
          const latestReadings = getLatestReadings(device.readings);
          const statusStyle = IOT_DEVICE_STATUS_STYLES[device.status];

          return (
            <Marker
              key={device.id}
              position={[device.latitude, device.longitude]}
              icon={createDeviceIcon(device.type, device.status)}
            >
              <Popup minWidth={200}>
                <div className="space-y-1.5 py-0.5">
                  <div className="font-semibold text-sm text-gray-900">{device.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{IOT_DEVICE_TYPE_ICONS[device.type]}</span>
                    <span className="text-xs text-gray-600">{IOT_DEVICE_TYPE_LABELS[device.type]}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusStyle.badge}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                  {device.lot && (
                    <div className="text-xs text-gray-500">📍 {device.lot.name}</div>
                  )}
                  {device.batteryPct != null && (
                    <div className="text-xs text-gray-500">
                      🔋 {device.batteryPct}%
                      {device.batteryPct < 20 && <span className="text-red-500 ml-1">Low!</span>}
                    </div>
                  )}
                  {/* Latest readings */}
                  {Object.entries(latestReadings).length > 0 && (
                    <div className="border-t pt-1 mt-1 space-y-0.5">
                      {Object.entries(latestReadings)
                        .slice(0, 4)
                        .map(([metric, { value, unit }]) => (
                          <div key={metric} className="text-xs flex justify-between gap-3">
                            <span className="text-gray-500 capitalize">
                              {metric.replace(/_/g, " ").replace(/pct/g, "%").replace(/c$/, "°")}
                            </span>
                            <span className="font-medium text-gray-800">
                              {value.toFixed(1)}{unit}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  {device.lastSeenAt && (
                    <div className="text-xs text-gray-400 border-t pt-1">
                      Last seen: {format(new Date(device.lastSeenAt), "MMM d, HH:mm", { locale: enUS })}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
