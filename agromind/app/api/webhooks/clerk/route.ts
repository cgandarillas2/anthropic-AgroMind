/**
 * Webhook de Clerk → sincroniza usuarios a la DB
 * Eventos: user.created, user.updated, user.deleted
 */
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const eventType = payload.type as string;
  const data = payload.data;

  try {
    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const email =
          data.email_addresses?.[0]?.email_address ?? "";
        const firstName = data.first_name ?? "";
        const lastName = data.last_name ?? "";
        const name = [firstName, lastName].filter(Boolean).join(" ") || email;

        await db.user.upsert({
          where: { clerkId: data.id },
          update: { email, name },
          create: {
            clerkId: data.id,
            email,
            name,
          },
        });
        break;
      }

      case "user.deleted": {
        await db.user.deleteMany({ where: { clerkId: data.id } });
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[CLERK_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
