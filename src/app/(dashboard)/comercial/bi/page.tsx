import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getComercialKPIs,
  getPedidosPorVendedor,
  getPedidosPorRegiao,
  getClientesAtivosVendedor,
  getClientesInativos,
  getProdutosEvolucao,
  getProdutosTopEvolucao,
  getTopClientes,
} from "@/lib/queries/comercial-analytics";
import { ComercialDashboard } from "./comercial-dashboard";

interface PageProps {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    modo?: string;
    vendedor?: string;
  }>;
}

export default async function ComercialBIPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const mes = params.mes ? Math.min(12, Math.max(1, Number(params.mes))) : currentMonth;
  const ano = params.ano ? Number(params.ano) : currentYear;
  const modo: "mes" | "acumulado" = params.modo === "mes" ? "mes" : "acumulado";
  const vendedor = params.vendedor && params.vendedor !== "todos" ? params.vendedor : null;

  const mesInicio = modo === "mes" ? mes : 1;

  const [
    kpis,
    pedidosVendedor,
    pedidosRegiao,
    clientesStatus,
    clientesInativos,
    evolucao,
    produtosTop,
    topGeral,
    topInternas,
  ] = await Promise.all([
    getComercialKPIs(mesInicio, mes, ano, vendedor),
    getPedidosPorVendedor(mesInicio, mes, ano, vendedor),
    getPedidosPorRegiao(mesInicio, mes, ano, vendedor),
    getClientesAtivosVendedor(),
    getClientesInativos(),
    getProdutosEvolucao(6, vendedor),
    getProdutosTopEvolucao(mesInicio, mes, ano, vendedor, 20),
    getTopClientes(mesInicio, mes, ano, "geral", 20, vendedor),
    getTopClientes(mesInicio, mes, ano, "vendas_internas", 20, vendedor),
  ]);

  return (
    <ComercialDashboard
      kpis={kpis}
      pedidosVendedor={pedidosVendedor}
      pedidosRegiao={pedidosRegiao}
      clientesStatus={clientesStatus}
      clientesInativos={clientesInativos}
      evolucao={evolucao}
      produtosTop={produtosTop}
      topGeral={topGeral}
      topInternas={topInternas}
      defaultMes={mes}
      defaultAno={ano}
      defaultModo={modo}
      defaultVendedor={vendedor}
    />
  );
}
