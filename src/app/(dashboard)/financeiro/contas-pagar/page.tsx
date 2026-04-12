import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getContasPagar, prefetchNextPage } from "@/lib/queries/contas-pagar";
import { ContasPagarTable } from "../../admin/contas-pagar/contas-pagar-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string }>;
}

export default async function FinanceiroContasPagarPage({ searchParams }: Props) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";

  const { data, total } = await getContasPagar(page, pageSize, search || undefined);
  if (data.length === pageSize) {
    prefetchNextPage(page, pageSize, search || undefined);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie as contas a pagar
        </p>
      </div>
      <ContasPagarTable data={data} total={total} page={page} pageSize={pageSize} search={search} />
    </div>
  );
}
