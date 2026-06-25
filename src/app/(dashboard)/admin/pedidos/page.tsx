import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPedidos, prefetchNextPage, getPedidosLastSync } from "@/lib/queries/pedidos";
import { PedidosTable } from "./pedidos-table";
import { PedidosLastSync } from "./pedidos-last-sync";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string }>;
}

export default async function PedidosPage({ searchParams }: Props) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";

  const [{ data, total }, lastSync] = await Promise.all([
    getPedidos(page, pageSize, search || undefined),
    getPedidosLastSync(),
  ]);
  if (data.length === pageSize) {
    prefetchNextPage(page, pageSize, search || undefined);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie pedidos de venda
        </p>
        <PedidosLastSync lastSync={lastSync} />
      </div>
      <PedidosTable data={data} total={total} page={page} pageSize={pageSize} search={search} />
    </div>
  );
}
