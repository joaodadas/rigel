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

export default async function ComercialBIPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [kpis, pedidosVendedor, pedidosRegiao, clientesStatus, clientesInativos, evolucao] =
    await Promise.all([
      getComercialKPIs(1, currentMonth, currentYear),
      getPedidosPorVendedor(1, currentMonth, currentYear),
      getPedidosPorRegiao(1, currentMonth, currentYear),
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
      defaultMes={currentMonth}
      defaultAno={currentYear}
    />
  );
}
