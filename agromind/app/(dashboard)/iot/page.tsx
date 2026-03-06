import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { IoTClient } from "@/components/iot/iot-client";

export const revalidate = 0; // always fresh — real-time sensor data

async function getIoTData(clerkId: string) {
  const farm = await db.farm.findFirst({
    where: { owner: { clerkId } },
    include: {
      lots: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      iotDevices: {
        include: {
          lot: { select: { id: true, name: true } },
          readings: {
            orderBy: { timestamp: "desc" },
            take: 40, // enough to get latest per metric + a few history points
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return farm;
}

export default async function IoTPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const farm = await getIoTData(userId);

  if (!farm) {
    return (
      <div className="text-center py-20 text-gray-400">
        No farm registered.{" "}
        <a href="/farms/new" className="text-green-600 underline">
          Create farm
        </a>
      </div>
    );
  }

  const onlineCount = farm.iotDevices.filter((d) => d.status === "ONLINE").length;
  const offlineCount = farm.iotDevices.filter((d) => d.status === "OFFLINE").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT Sensors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {farm.name} · {farm.iotDevices.length} device{farm.iotDevices.length !== 1 ? "s" : ""}
            {farm.iotDevices.length > 0 && (
              <>
                {" "}·{" "}
                <span className="text-green-600 font-medium">{onlineCount} online</span>
                {offlineCount > 0 && (
                  <span className="text-red-500 font-medium">, {offlineCount} offline</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <IoTClient
        farm={{
          id: farm.id,
          name: farm.name,
          commune: farm.commune,
          latitude: farm.latitude,
          longitude: farm.longitude,
          lots: farm.lots,
        }}
        initialDevices={farm.iotDevices}
      />
    </div>
  );
}
