import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/alerts?farmId=&isRead=false
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const isRead = searchParams.get("isRead");

  try {
    const farm = await db.farm.findFirst({
      where: farmId
        ? { id: farmId, owner: { clerkId: userId } }
        : { owner: { clerkId: userId } },
    });
    if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

    const alerts = await db.alert.findMany({
      where: {
        farmId: farm.id,
        ...(isRead !== null ? { isRead: isRead === "true" } : {}),
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("[ALERTS_GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/alerts  body: { id, isRead?, isResolved? }
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, isRead, isResolved } = body as {
      id: string;
      isRead?: boolean;
      isResolved?: boolean;
    };

    // Verify ownership
    const alert = await db.alert.findFirst({
      where: { id, farm: { owner: { clerkId: userId } } },
    });
    if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.alert.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(isResolved !== undefined && {
          isResolved,
          resolvedAt: isResolved ? new Date() : null,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ALERTS_PATCH]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/alerts/read-all — mark all as read
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const farm = await db.farm.findFirst({
      where: { owner: { clerkId: userId } },
    });
    if (!farm) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.alert.updateMany({
      where: { farmId: farm.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ALERTS_PUT]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
