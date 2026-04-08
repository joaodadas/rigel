import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContasPagar } from "@/lib/queries/contas-pagar";
import { ContasPagarTable } from "./contas-pagar-table";

export default async function ContasPagarPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const contasPagar = await getContasPagar();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie as contas a pagar
        </p>
      </div>
      <ContasPagarTable data={contasPagar} />
    </div>
  );
}
