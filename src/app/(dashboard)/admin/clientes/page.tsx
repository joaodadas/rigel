import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClientes } from "@/lib/queries/clientes";
import { ClientesTable } from "./clientes-table";

export default async function ClientesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const clientes = await getClientes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie a base de clientes
        </p>
      </div>
      <ClientesTable data={clientes} />
    </div>
  );
}
