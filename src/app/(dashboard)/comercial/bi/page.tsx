import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getComercialKPIs,
  getPedidosPorVendedor,
  getPedidosPorRegiao,
  getClientesAtivosVendedor,
  getClientesInativos,
  getProdutosEvolucao,
  getTop20Clientes,
} from "@/lib/queries/comercial-analytics";
import { ComercialDashboard } from "./comercial-dashboard";

interface PageProps {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function ComercialBIPage({ searchParams }: PageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // mes=0 means "Acumulado", 1-12 means specific month
  const rawMes = params.mes !== undefined ? Number(params.mes) : currentMonth;
  const mes = Math.min(12, Math.max(0, rawMes));
  const ano = params.ano ? Number(params.ano) : currentYear;

  const isAcumulado = mes === 0;
  const mesInicio = isAcumulado ? 1 : mes;
  const mesFim = isAcumulado ? currentMonth : mes;

  // Calculate previous month for delta (only when specific month selected)
  let prevMes: number | null = null;
  let prevAno: number | null = null;
  if (!isAcumulado) {
    if (mes === 1) {
      prevMes = 12;
      prevAno = ano - 1;
    } else {
      prevMes = mes - 1;
      prevAno = ano;
    }
  }

  const [
    kpis,
    pedidosVendedor,
    pedidosRegiao,
    clientesStatus,
    clientesInativos,
    evolucao,
    top20Geral,
    top20VI,
    pedidosVendedorPrev,
  ] = await Promise.all([
    getComercialKPIs(mesInicio, mesFim, ano),
    getPedidosPorVendedor(mesInicio, mesFim, ano),
    getPedidosPorRegiao(mesInicio, mesFim, ano),
    getClientesAtivosVendedor(),
    getClientesInativos(),
    getProdutosEvolucao(6),
    getTop20Clientes(mesInicio, mesFim, ano, false),
    getTop20Clientes(mesInicio, mesFim, ano, true),
    prevMes !== null && prevAno !== null
      ? getPedidosPorVendedor(prevMes, prevMes, prevAno)
      : (null as unknown as ReturnType<typeof getPedidosPorVendedor>),
  ]);

  return (
    <ComercialDashboard
      kpis={kpis}
      pedidosVendedor={pedidosVendedor}
      pedidosRegiao={pedidosRegiao}
      clientesStatus={clientesStatus}
      clientesInativos={clientesInativos}
      evolucao={evolucao}
      top20Geral={top20Geral}
      top20VI={top20VI}
      pedidosVendedorPrev={pedidosVendedorPrev as Awaited<ReturnType<typeof getPedidosPorVendedor>> | null}
      defaultMes={mes}
      defaultAno={ano}
      isAcumulado={isAcumulado}
    />
  );
}
