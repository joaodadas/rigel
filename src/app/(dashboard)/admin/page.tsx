import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminKPIs } from "@/lib/queries/admin-kpis";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  DollarSign,
  ShoppingCart,
  Users,
  UserX,
  Receipt,
  CreditCard,
} from "lucide-react";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const kpis = await getAdminKPIs();

  const cards = [
    {
      title: "Faturamento do Mes",
      value: formatBRL(kpis.faturamentoMes),
      description: "Pedidos atendidos no mes atual",
      icon: DollarSign,
      trend: "neutral" as const,
    },
    {
      title: "Pedidos do Mes",
      value: formatNumber(kpis.pedidosMes),
      description: "Total de pedidos no mes atual",
      icon: ShoppingCart,
      trend: "neutral" as const,
    },
    {
      title: "Clientes Ativos",
      value: formatNumber(kpis.clientesAtivos),
      description: `${formatNumber(kpis.clientesInativos)} inativos`,
      icon: Users,
      trend: "neutral" as const,
    },
    {
      title: "A Receber em Aberto",
      value: formatBRL(kpis.contasReceberAberto),
      description: "Contas nao liquidadas",
      icon: Receipt,
      trend: "neutral" as const,
    },
    {
      title: "A Pagar (7 dias)",
      value: formatBRL(kpis.contasPagarVencendo),
      description: "Vencendo nos proximos 7 dias",
      icon: CreditCard,
      trend: "neutral" as const,
    },
    {
      title: "Vendedores Ativos",
      value: formatNumber(kpis.vendedoresAtivos),
      description: "Vendedores com situacao ativa",
      icon: UserX,
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visao geral do sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <KpiCard key={card.title} index={index} {...card} />
        ))}
      </div>
    </div>
  );
}
