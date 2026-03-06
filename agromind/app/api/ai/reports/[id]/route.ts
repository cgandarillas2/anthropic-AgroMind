import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/reports/[id] - get full report content
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await db.savedReport.findUnique({ where: { id } });

    if (!report || report.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (e) {
    console.error("[REPORT_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/ai/reports/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await db.savedReport.findUnique({ where: { id } });

    if (!report || report.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.savedReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[REPORT_DELETE]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
