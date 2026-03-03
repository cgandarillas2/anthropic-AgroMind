import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AiAgentClient } from "@/components/ai/ai-agent-client";

export default async function AiAgentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Agent</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cherry expert agronomist — Maule Region
        </p>
      </div>
      <AiAgentClient />
    </div>
  );
}
