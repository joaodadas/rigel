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
import { ComercialDashboard } from "../../comercial/bi/comercial-dashboard";

export default async function AdminBIPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [kpis, pedidosVendedor, pedidosRegiao, clientesStatus, clientesInativos, evolucao, top20Geral, top20VI] =
    await Promise.all([
      getComercialKPIs(1, currentMonth, currentYear),
      getPedidosPorVendedor(1, currentMonth, currentYear),
      getPedidosPorRegiao(1, currentMonth, currentYear),
      getClientesAtivosVendedor(),
      getClientesInativos(),
      getProdutosEvolucao(6),
      getTop20Clientes(1, currentMonth, currentYear, false),
      getTop20Clientes(1, currentMonth, currentYear, true),
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
      pedidosVendedorPrev={null}
      defaultMes={currentMonth}
      defaultAno={currentYear}
      isAcumulado={true}
    />
  );
}
