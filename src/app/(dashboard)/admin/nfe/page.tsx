import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotasFiscais } from "@/lib/queries/notas-fiscais";
import { NfeTable } from "./nfe-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string }>;
}

export default async function NfePage({ searchParams }: Props) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";

  const { data, total } = await getNotasFiscais(page, pageSize, search || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notas Fiscais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie notas fiscais eletronicas
        </p>
      </div>
      <NfeTable data={data} total={total} page={page} pageSize={pageSize} search={search} />
    </div>
  );
}
