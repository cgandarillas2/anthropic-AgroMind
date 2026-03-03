import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AlertsClient } from "@/components/alerts/alerts-client";

async function getAlerts(clerkId: string) {
  const farm = await db.farm.findFirst({
    where: { owner: { clerkId } },
    include: {
      alerts: {
        orderBy: [{ isResolved: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
      },
    },
  });
  return farm;
}

export default async function AlertsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const farm = await getAlerts(userId);

  if (!farm) {
    return (
      <div className="text-center py-20 text-gray-400">
        No farm registered.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{farm.name}</p>
        </div>
        <div className="text-sm text-gray-500">
          {farm.alerts.filter((a) => !a.isRead).length} unread
        </div>
      </div>
      <AlertsClient alerts={farm.alerts} farmId={farm.id} />
    </div>
  );
}
