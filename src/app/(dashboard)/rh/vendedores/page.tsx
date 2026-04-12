import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getVendedores } from "@/lib/queries/vendedores";
import { VendedoresTable } from "../../admin/vendedores/vendedores-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string }>;
}

export default async function RhVendedoresPage({ searchParams }: Props) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";

  const { data, total } = await getVendedores(page, pageSize, search || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os vendedores
        </p>
      </div>
      <VendedoresTable data={data} total={total} page={page} pageSize={pageSize} search={search} />
    </div>
  );
}
