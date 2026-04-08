import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPedidos } from "@/lib/queries/pedidos";
import { PedidosTable } from "./pedidos-table";

export default async function PedidosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const pedidos = await getPedidos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie pedidos de venda
        </p>
      </div>
      <PedidosTable data={pedidos} />
    </div>
  );
}
