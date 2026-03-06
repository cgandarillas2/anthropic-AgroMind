import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const CreateFarmSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  region: z.string().min(1),
  commune: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalArea: z.number().positive(),
});

async function getDbUser(clerkId: string) {
  return db.user.findUnique({ where: { clerkId } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const farms = await db.farm.findMany({
    where: { ownerId: user.id },
    include: {
      lots: {
        include: {
          crops: {
            include: { productionCycles: { where: { isActive: true } } },
          },
        },
      },
      _count: { select: { alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(farms);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const body = CreateFarmSchema.parse(await req.json());
    const farm = await db.farm.create({
      data: { ...body, ownerId: user.id },
    });
    return NextResponse.json(farm, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[FARMS_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
