import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateInputSchema = z.object({
  productionCycleId: z.string(),
  date: z.string(),
  category: z.enum(["FERTILIZANTE","HERBICIDA","FUNGICIDA","INSECTICIDA","RIEGO","MATERIAL_VEGETAL","OTRO"]),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  costPerUnit: z.number().nonnegative(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/inputs?cycleId=
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycleId = new URL(req.url).searchParams.get("cycleId");

  try {
    const inputs = await db.input.findMany({
      where: {
        ...(cycleId ? { productionCycleId: cycleId } : {}),
        productionCycle: { crop: { lot: { farm: { owner: { clerkId: userId } } } } },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(inputs);
  } catch (e) {
    console.error("[INPUTS_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/inputs
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = CreateInputSchema.parse(await req.json());

    // Verify cycle ownership
    const cycle = await db.productionCycle.findFirst({
      where: { id: body.productionCycleId, crop: { lot: { farm: { owner: { clerkId: userId } } } } },
    });
    if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

    const totalCost = body.quantity * body.costPerUnit;
    const input = await db.input.create({
      data: { ...body, date: new Date(body.date), totalCost },
    });
    return NextResponse.json(input, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[INPUTS_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/inputs?id=
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const input = await db.input.findFirst({
      where: { id, productionCycle: { crop: { lot: { farm: { owner: { clerkId: userId } } } } } },
    });
    if (!input) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.input.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[INPUTS_DELETE]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
