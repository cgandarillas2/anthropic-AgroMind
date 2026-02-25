import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { InputsClient } from "@/components/inputs/inputs-client";

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
                include: { inputs: { orderBy: { date: "desc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!farm) return null;

  const cycles = farm.lots
    .flatMap((l) => l.crops.flatMap((c) => c.productionCycles.map((cy) => ({ ...cy, crop: { ...c, lot: l } }))))
    .filter((cy) => cy.isActive);

  const inputs = cycles.flatMap((c) => c.inputs).sort((a, b) => +b.date - +a.date);

  return { farm, cycles, inputs };
}

export default async function InputsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getData(userId);
  if (!data) return <div className="text-gray-400 py-20 text-center">Sin predio registrado.</div>;

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insumos</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data.farm.name} · Temporada activa</p>
      </div>
      <InputsClient inputs={data.inputs} cycles={data.cycles} />
    </div>
  );
}
