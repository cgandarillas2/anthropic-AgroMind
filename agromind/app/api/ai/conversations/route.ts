import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/conversations - list user's conversations (without messages)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversations = await db.chatConversation.findMany({
      where: { clerkId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json(conversations);
  } catch (e) {
    console.error("[CONVERSATIONS_GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/ai/conversations - create a new conversation with messages
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, messages } = await req.json() as {
      title?: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages" }, { status: 400 });
    }

    const autoTitle = title || messages.find((m) => m.role === "user")?.content.slice(0, 60) || "New conversation";

    const conversation = await db.chatConversation.create({
      data: {
        clerkId: userId,
        title: autoTitle,
        messages: {
          create: messages.map((m) => ({
            role: m.role === "user" ? "USER" : "ASSISTANT",
            content: m.content,
          })),
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (e) {
    console.error("[CONVERSATIONS_POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
