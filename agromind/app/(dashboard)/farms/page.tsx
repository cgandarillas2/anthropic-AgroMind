import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { FarmsClient } from "@/components/farms/farms-client";

async function getFarms(clerkId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return [];

  return db.farm.findMany({
    where: { ownerId: user.id },
    include: {
      lots: {
        include: {
          crops: {
            include: { productionCycles: { where: { isActive: true } } },
          },
        },
      },
      _count: { select: { alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function FarmsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const farms = await getFarms(userId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Farms</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your farms and production units
        </p>
      </div>
      <FarmsClient initialFarms={farms} />
    </div>
  );
}
