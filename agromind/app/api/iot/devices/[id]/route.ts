import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  batteryPct: z.number().int().min(0).max(100).optional().nullable(),
  lotId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// PATCH /api/iot/devices/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = UpdateDeviceSchema.parse(await req.json());

    const device = await db.ioTDevice.findFirst({
      where: { id, farm: { owner: { clerkId: userId } } },
    });
    if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.ioTDevice.update({
      where: { id },
      data: body,
      include: { lot: { select: { id: true, name: true } }, readings: { orderBy: { timestamp: "desc" }, take: 20 } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[IOT_DEVICES_PATCH]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/iot/devices/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const device = await db.ioTDevice.findFirst({
      where: { id, farm: { owner: { clerkId: userId } } },
    });
    if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.ioTDevice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[IOT_DEVICES_DELETE]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
