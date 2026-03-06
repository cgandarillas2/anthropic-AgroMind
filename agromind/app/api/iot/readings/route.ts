import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const IngestReadingSchema = z.object({
  deviceId: z.string(),
  metric: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  timestamp: z.string().optional(), // ISO string; defaults to now
});

// GET /api/iot/readings?deviceId=&metric=&hours=24
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  const metric = searchParams.get("metric");
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);

  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  try {
    // Verify ownership
    const device = await db.ioTDevice.findFirst({
      where: { id: deviceId, farm: { owner: { clerkId: userId } } },
      select: { id: true },
    });
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await db.ioTReading.findMany({
      where: {
        deviceId,
        ...(metric ? { metric } : {}),
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json(readings);
  } catch (e) {
    console.error("[IOT_READINGS_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/iot/readings — ingest a reading from a device
// Note: No auth required here (devices call this directly).
// In production, add a device API key / HMAC signature check.
export async function POST(req: NextRequest) {
  try {
    const body = IngestReadingSchema.parse(await req.json());

    const device = await db.ioTDevice.findUnique({
      where: { id: body.deviceId },
      select: { id: true, farmId: true, type: true, status: true },
    });
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();

    // Create reading
    const reading = await db.ioTReading.create({
      data: {
        deviceId: body.deviceId,
        metric: body.metric,
        value: body.value,
        unit: body.unit,
        timestamp,
      },
    });

    // Update device lastSeenAt + status to ONLINE
    await db.ioTDevice.update({
      where: { id: body.deviceId },
      data: { lastSeenAt: timestamp, status: "ONLINE" },
    });

    // ── Auto-alert thresholds ──────────────────────────────
    const alertChecks: Array<{
      condition: boolean;
      type: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
    }> = [
      {
        condition: body.metric === "temperature_c" && body.value < -1,
        type: "FROST",
        severity: "CRITICAL",
        title: `🧊 Frost detected — ${body.value.toFixed(1)}°C`,
        description: `IoT sensor ${device.id} recorded ${body.value.toFixed(1)}°C at canopy level. Risk of frost damage to exposed flowers and fruit.`,
        recommendation: "Activate frost protection immediately: activate irrigation (aspersion), verify wind machines are operational.",
      },
      {
        condition: body.metric === "soil_moisture_20cm_pct" && body.value < 20,
        type: "IRRIGATION_PENDING",
        severity: "WARNING",
        title: `💧 Low soil moisture — ${body.value.toFixed(0)}% at 20cm`,
        description: `Soil moisture sensor reported ${body.value.toFixed(0)}% volumetric water content at 20cm depth. Below optimal range (25–40%) for cherry trees.`,
        recommendation: "Start irrigation cycle. Check drip emitters and filter status. Target: bring surface layer to 35–40% field capacity.",
      },
      {
        condition: body.metric === "humidity_pct" && body.value > 90,
        type: "HIGH_HUMIDITY",
        severity: "WARNING",
        title: `🌫️ High humidity — ${body.value.toFixed(0)}% RH`,
        description: `Relative humidity at ${body.value.toFixed(0)}% RH — above 90% threshold. High risk of Botrytis cinerea and Monilinia fructicola development.`,
        recommendation: "Apply preventive fungicide (fludioxonil or captan). Improve canopy aeration if possible. Monitor leaf wetness duration.",
      },
    ];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const check of alertChecks) {
      if (!check.condition) continue;

      // Avoid duplicate alerts of same type today
      const exists = await db.alert.findFirst({
        where: {
          farmId: device.farmId,
          type: check.type as never,
          isResolved: false,
          createdAt: { gte: todayStart },
        },
      });

      if (!exists) {
        await db.alert.create({
          data: {
            farmId: device.farmId,
            type: check.type as never,
            severity: check.severity as never,
            title: check.title,
            description: check.description,
            recommendation: check.recommendation,
            triggerValue: body.value,
            triggerMetric: body.metric,
            source: "AUTOMATIC",
          },
        });
      }
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[IOT_READINGS_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
