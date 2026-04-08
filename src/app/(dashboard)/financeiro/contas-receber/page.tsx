import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContasReceber } from "@/lib/queries/contas-receber";
import { ContasReceberTable } from "../../admin/contas-receber/contas-receber-table";

export default async function FinanceiroContasReceberPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const contasReceber = await getContasReceber();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Receber</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie as contas a receber
        </p>
      </div>
      <ContasReceberTable data={contasReceber} />
    </div>
  );
}
