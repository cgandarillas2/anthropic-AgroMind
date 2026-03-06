import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SavedReportType } from "@prisma/client";

const REPORT_TITLES: Record<string, string> = {
  weekly: "Weekly Report",
  risk: "Risk Analysis",
  harvest: "Harvest Estimate",
};

// GET /api/ai/reports - list saved reports
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const reports = await db.savedReport.findMany({
      where: { clerkId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, title: true, createdAt: true },
    });
    return NextResponse.json(reports);
  } catch (e) {
    console.error("[REPORTS_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/ai/reports - save a report
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { type, content } = await req.json() as { type: string; content: string };

    if (!["weekly", "risk", "harvest"].includes(type) || !content) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const typeMap: Record<string, SavedReportType> = {
      weekly: "WEEKLY",
      risk: "RISK",
      harvest: "HARVEST",
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const title = `${REPORT_TITLES[type]} — ${dateStr}`;

    const report = await db.savedReport.create({
      data: {
        clerkId: userId,
        type: typeMap[type],
        title,
        content,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (e) {
    console.error("[REPORTS_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
