import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProdutos } from "@/lib/queries/produtos";
import { ProdutosTable } from "./produtos-table";

export default async function ProdutosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const produtos = await getProdutos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie o catalogo de produtos
        </p>
      </div>
      <ProdutosTable data={produtos} />
    </div>
  );
}
