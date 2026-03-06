import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FinanceClient } from "@/components/finance/finance-client";

export default async function FinancePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Resumen de gastos por insumos y mano de obra en ciclos activos
        </p>
      </div>
      <FinanceClient />
    </div>
  );
}
