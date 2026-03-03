import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const UpdateFarmSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  commune: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  totalArea: z.number().positive().optional(),
});

async function getFarmForUser(farmId: string, clerkId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;
  return db.farm.findFirst({ where: { id: farmId, ownerId: user.id } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { farmId } = await params;
  const farm = await db.farm.findFirst({
    where: {
      id: farmId,
      owner: { clerkId: userId },
    },
    include: {
      lots: {
        include: {
          crops: {
            include: {
              productionCycles: {
                where: { isActive: true },
                include: {
                  inputs: { orderBy: { date: "desc" }, take: 5 },
                  laborRecords: { orderBy: { date: "desc" }, take: 5 },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
      alerts: {
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!farm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(farm);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { farmId } = await params;
  const farm = await getFarmForUser(farmId, userId);
  if (!farm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = UpdateFarmSchema.parse(await req.json());
    const updated = await db.farm.update({ where: { id: farmId }, data: body });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[FARM_PATCH]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { farmId } = await params;
  const farm = await getFarmForUser(farmId, userId);
  if (!farm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.farm.delete({ where: { id: farmId } });
  return new NextResponse(null, { status: 204 });
}
