import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateDeviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["WEATHER_STATION", "TEMPERATURE_HUMIDITY", "SOIL_MOISTURE", "FROST_SENSOR", "FLOW_METER", "LEAF_WETNESS"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  lotId: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/iot/devices — list devices for the user's farm with latest readings
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const farm = await db.farm.findFirst({
      where: { owner: { clerkId: userId } },
      select: { id: true },
    });
    if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

    const devices = await db.ioTDevice.findMany({
      where: { farmId: farm.id },
      include: {
        lot: { select: { id: true, name: true } },
        readings: {
          orderBy: { timestamp: "desc" },
          take: 20, // enough to get latest value per metric
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(devices);
  } catch (e) {
    console.error("[IOT_DEVICES_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/iot/devices — create a new device
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = CreateDeviceSchema.parse(await req.json());

    const farm = await db.farm.findFirst({
      where: { owner: { clerkId: userId } },
      select: { id: true },
    });
    if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

    // If lotId provided, verify it belongs to this farm
    if (body.lotId) {
      const lot = await db.lot.findFirst({ where: { id: body.lotId, farmId: farm.id } });
      if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const device = await db.ioTDevice.create({
      data: {
        ...body,
        farmId: farm.id,
      },
      include: { lot: { select: { id: true, name: true } }, readings: true },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[IOT_DEVICES_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
