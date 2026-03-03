import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAgronomicContext } from "@/lib/ai/context";
import { SYSTEM_PROMPT, getReportPrompt } from "@/lib/ai/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await req.json() as { type: "weekly" | "risk" | "harvest" };
  if (!["weekly", "risk", "harvest"].includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  try {
    const context = await buildAgronomicContext(userId);
    const reportPrompt = getReportPrompt(type);

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<contexto_predio>\n${context}\n</contexto_predio>\n\n${reportPrompt}`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (e: unknown) {
          const msg =
            e instanceof Error && e.message.includes("credit balance")
              ? "❌ No credits in Anthropic API. Go to console.anthropic.com → Plans & Billing to recharge."
              : "❌ Error generating report. Check your connection and try again.";
          controller.enqueue(encoder.encode(msg));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("[AI_REPORT]", e);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
