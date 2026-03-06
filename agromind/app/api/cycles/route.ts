import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateCycleSchema = z.object({
  id: z.string(),
  phenologicalStage: z.enum(["DORMANCY","BUDBREAK","FLOWERING","FRUIT_SET","FRUIT_GROWTH","FRUIT_FILL","MATURITY","POST_HARVEST"]).optional(),
  chillHoursAccumulated: z.number().int().nonnegative().optional(),
  estimatedCalibration: z.number().positive().optional().nullable(),
  estimatedYield: z.number().positive().optional().nullable(),
  estimatedHarvestDate: z.string().optional().nullable(),
  productionDestination: z.enum(["EXPORT","DOMESTIC_MARKET","INDUSTRY","MIXED"]).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/cycles — user's active cycles
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cycles = await db.productionCycle.findMany({
      where: {
        isActive: true,
        crop: { lot: { farm: { owner: { clerkId: userId } } } },
      },
      include: {
        crop: { include: { lot: { include: { farm: true } } } },
        inputs: true,
        laborRecords: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(cycles);
  } catch (e) {
    console.error("[CYCLES_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/cycles — update cycle
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = UpdateCycleSchema.parse(await req.json());
    const { id, estimatedHarvestDate, ...rest } = body;

    const cycle = await db.productionCycle.findFirst({
      where: { id, crop: { lot: { farm: { owner: { clerkId: userId } } } } },
    });
    if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.productionCycle.update({
      where: { id },
      data: {
        ...rest,
        ...(estimatedHarvestDate !== undefined && {
          estimatedHarvestDate: estimatedHarvestDate ? new Date(estimatedHarvestDate) : null,
        }),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[CYCLES_PATCH]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
