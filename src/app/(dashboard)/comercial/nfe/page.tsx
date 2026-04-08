import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getNotasFiscais } from "@/lib/queries/notas-fiscais";
import { NfeTable } from "../../admin/nfe/nfe-table";

export default async function ComercialNfePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const notas = await getNotasFiscais();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notas Fiscais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie notas fiscais eletronicas
        </p>
      </div>
      <NfeTable data={notas} />
    </div>
  );
}
