import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getComercialKPIs,
  getPedidosPorVendedor,
  getPedidosPorRegiao,
  getClientesAtivosVendedor,
  getClientesInativos,
  getProdutosEvolucao,
} from "@/lib/queries/comercial-analytics";
import { ComercialDashboard } from "./comercial-dashboard";

interface PageProps {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function ComercialBIPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Use URL params or default to current month/year
  const mes = params.mes ? Math.min(12, Math.max(1, Number(params.mes))) : currentMonth;
  const ano = params.ano ? Number(params.ano) : currentYear;

  const [kpis, pedidosVendedor, pedidosRegiao, clientesStatus, clientesInativos, evolucao] =
    await Promise.all([
      getComercialKPIs(1, mes, ano),
      getPedidosPorVendedor(1, mes, ano),
      getPedidosPorRegiao(1, mes, ano),
      getClientesAtivosVendedor(),
      getClientesInativos(),
      getProdutosEvolucao(6),
    ]);

  return (
    <ComercialDashboard
      kpis={kpis}
      pedidosVendedor={pedidosVendedor}
      pedidosRegiao={pedidosRegiao}
      clientesStatus={clientesStatus}
      clientesInativos={clientesInativos}
      evolucao={evolucao}
      defaultMes={mes}
      defaultAno={ano}
    />
  );
}
