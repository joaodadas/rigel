import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getVendedores } from "@/lib/queries/vendedores";
import { VendedoresTable } from "../../admin/vendedores/vendedores-table";

export default async function RhVendedoresPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const vendedores = await getVendedores();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os vendedores
        </p>
      </div>
      <VendedoresTable data={vendedores} />
    </div>
  );
}
