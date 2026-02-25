import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAgronomicContext } from "@/lib/ai/context";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  try {
    // Construir contexto agronómico del predio
    const context = await buildAgronomicContext(userId);

    // Inyectar contexto como primer mensaje del sistema (user turn)
    const messagesWithContext = [
      {
        role: "user" as const,
        content: `<contexto_predio>\n${context}\n</contexto_predio>\n\n${messages[0].content}`,
      },
      ...messages.slice(1),
    ];

    // Streaming response
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messagesWithContext,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[AI_CHAT]", e);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
