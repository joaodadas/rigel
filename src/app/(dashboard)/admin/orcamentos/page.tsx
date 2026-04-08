import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOrcamentos } from "@/lib/queries/orcamentos";
import { OrcamentosTable } from "./orcamentos-table";

export default async function OrcamentosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const orcamentos = await getOrcamentos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orcamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie orcamentos de venda
        </p>
      </div>
      <OrcamentosTable data={orcamentos} />
    </div>
  );
}
