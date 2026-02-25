import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateLaborSchema = z.object({
  productionCycleId: z.string(),
  date: z.string(),
  activity: z.enum(["PODA","RALEO","APLICACION_FITOSANITARIA","RIEGO","FERTILIZACION","COSECHA","EMPAQUE","MONITOREO","INSTALACION_MALLA","OTRO"]),
  workerCount: z.number().int().positive(),
  hoursPerWorker: z.number().positive(),
  costPerHour: z.number().nonnegative(),
  notes: z.string().optional(),
});

// GET /api/labor?cycleId=
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycleId = new URL(req.url).searchParams.get("cycleId");

  try {
    const records = await db.laborRecord.findMany({
      where: {
        ...(cycleId ? { productionCycleId: cycleId } : {}),
        productionCycle: { crop: { lot: { farm: { owner: { clerkId: userId } } } } },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(records);
  } catch (e) {
    console.error("[LABOR_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/labor
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = CreateLaborSchema.parse(await req.json());

    const cycle = await db.productionCycle.findFirst({
      where: { id: body.productionCycleId, crop: { lot: { farm: { owner: { clerkId: userId } } } } },
    });
    if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

    const totalHours = body.workerCount * body.hoursPerWorker;
    const totalCost = totalHours * body.costPerHour;

    const record = await db.laborRecord.create({
      data: { ...body, date: new Date(body.date), totalHours, totalCost },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
    console.error("[LABOR_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/labor?id=
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const record = await db.laborRecord.findFirst({
      where: { id, productionCycle: { crop: { lot: { farm: { owner: { clerkId: userId } } } } } },
    });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.laborRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[LABOR_DELETE]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
