import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/conversations/[id] - get conversation with all messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await db.chatConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation || conversation.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

// PUT /api/ai/conversations/[id] - add new messages or rename conversation
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await db.chatConversation.findUnique({ where: { id } });

  if (!conversation || conversation.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { title, messages } = await req.json() as {
    title?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  };

  const updated = await db.chatConversation.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(messages?.length
        ? {
            messages: {
              create: messages.map((m) => ({
                role: m.role === "user" ? "USER" : "ASSISTANT",
                content: m.content,
              })),
            },
          }
        : {}),
      updatedAt: new Date(),
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/ai/conversations/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await db.chatConversation.findUnique({ where: { id } });

  if (!conversation || conversation.clerkId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.chatConversation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
