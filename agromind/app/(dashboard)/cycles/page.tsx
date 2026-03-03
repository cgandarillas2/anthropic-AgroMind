import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CycleEditor } from "@/components/cycles/cycle-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

async function getData(clerkId: string) {
  const farm = await db.farm.findFirst({
    where: { owner: { clerkId } },
    include: {
      lots: {
        include: {
          crops: {
            include: {
              productionCycles: {
                where: { isActive: true },
                include: {
                  inputs: true,
                  laborRecords: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!farm) return null;

  const cycles = farm.lots.flatMap((l) =>
    l.crops.flatMap((c) =>
      c.productionCycles.map((cy) => ({
        ...cy,
        crop: { ...c, lot: l },
      }))
    )
  ).filter((cy) => cy.isActive);

  return { farm, cycles };
}

export default async function CyclesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getData(userId);
  if (!data) return <div className="text-gray-400 py-20 text-center">No farm registered.</div>;

  const { farm, cycles } = data;

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Active cycle</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {farm.name} · {cycles.length} active cycle(s)
        </p>
      </div>

      {cycles.length === 0 && (
        <div className="text-center py-20 text-gray-400">No active cycles.</div>
      )}

      {cycles.length === 1 && <CycleEditor cycle={cycles[0]} />}

      {cycles.length > 1 && (
        <Tabs defaultValue={cycles[0].id}>
          <TabsList>
            {cycles.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.crop.variety} · {c.crop.lot.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {cycles.map((c) => (
            <TabsContent key={c.id} value={c.id}>
              <CycleEditor cycle={c} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
