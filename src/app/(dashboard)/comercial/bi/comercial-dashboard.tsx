"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Target,
  TrendingUp,
  Receipt,
  Users,
  UserX,
  Database,
} from "lucide-react";
// Select components now used via BiFilters
import { KpiCard } from "@/components/dashboard/kpi-card";
import type {
  ComercialKPIs,
  PedidoVendedor,
  PedidoRegiao,
  ClienteVendedorStatus,
  ClienteInativo,
  ProdutoEvolucao,
  TopCliente,
  ClienteB2B,
} from "@/lib/queries/comercial-analytics";
import { BiFilters, getMesLabel } from "./components/bi-filters";
import { TopClientesSection } from "./components/top-clientes-section";
import { PedidosVendedorSection } from "./components/pedidos-vendedor-section";
import { PedidosRegiaoSection } from "./components/pedidos-regiao-section";
import { BaseAtivaSection } from "./components/base-ativa-section";
import { ClientesInativosSection } from "./components/clientes-inativos-section";
import {
  formatBRL,
  formatBRLFull,
  formatNumber,
  formatPct,
} from "./components/formatters";
import { ProdutosEvolucaoSection } from "./components/produtos-evolucao-section";
import { DemoClienteSection } from "./components/demo-cliente-section";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComercialDashboardProps {
  kpis: ComercialKPIs;
  pedidosVendedor: PedidoVendedor[];
  pedidosRegiao: PedidoRegiao[];
  clientesStatus: ClienteVendedorStatus[];
  clientesInativos: ClienteInativo[];
  evolucao: ProdutoEvolucao[];
  top20Geral: TopCliente[];
  top20VI: TopCliente[];
  pedidosVendedorPrev: PedidoVendedor[] | null;
  clientesB2B: ClienteB2B[];
  defaultMes: number;
  defaultAno: number;
  isAcumulado: boolean;
}

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Marco" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComercialDashboard({
  kpis,
  pedidosVendedor,
  pedidosRegiao,
  clientesStatus,
  clientesInativos,
  evolucao,
  top20Geral,
  top20VI,
  pedidosVendedorPrev,
  clientesB2B,
  defaultMes,
  defaultAno,
  isAcumulado,
}: ComercialDashboardProps) {
  const router = useRouter();
  const mes = defaultMes;
  const ano = defaultAno;
  const [vendedorFilter, setVendedorFilter] = useState("todos");

  const navigateToMonth = useCallback(
    (newMes: number, newAno?: number) => {
      router.push(`?mes=${newMes}&ano=${newAno ?? ano}`);
    },
    [router, ano]
  );

  // Distinct vendedores for filter
  const vendedores = useMemo(() => {
    const names = new Set<string>();
    pedidosVendedor.forEach((p) => names.add(p.vendedor));
    clientesStatus.forEach((c) => names.add(c.vendedor));
    return Array.from(names).sort();
  }, [pedidosVendedor, clientesStatus]);

  // KPI cards data
  const kpiCards = [
    {
      title: "Faturamento B2B",
      value: formatBRL(kpis.faturamentoB2B),
      description: `${formatNumber(kpis.totalPedidos)} pedidos atendidos`,
      icon: DollarSign,
      trend: "neutral" as const,
    },
    {
      title: "Meta B2B Acumulada",
      value: formatBRL(kpis.metaB2BAcumulada),
      description: isAcumulado
        ? `Meta acumulada ${ano}`
        : `Meta ate ${MESES[mes - 1]?.label ?? mes}/${ano}`,
      icon: Target,
      trend: "neutral" as const,
    },
    {
      title: "% Atingimento",
      value: formatPct(kpis.pctAtingimento),
      description:
        kpis.pctAtingimento >= 100 ? "Meta atingida" : "Abaixo da meta",
      icon: TrendingUp,
      trend:
        kpis.pctAtingimento >= 100
          ? ("up" as const)
          : kpis.pctAtingimento >= 80
            ? ("neutral" as const)
            : ("down" as const),
    },
    {
      title: "Ticket Medio",
      value: formatBRLFull(kpis.ticketMedio),
      description: "Valor medio por pedido",
      icon: Receipt,
      trend: "neutral" as const,
    },
    {
      title: "Clientes Ativos",
      value: formatNumber(kpis.clientesAtivos),
      description: "Ultimos 6 meses",
      icon: Users,
      trend: "neutral" as const,
    },
    {
      title: "Clientes Inativos",
      value: formatNumber(kpis.clientesInativos),
      description: "Sem compra ha 6+ meses",
      icon: UserX,
      trend: kpis.clientesInativos > kpis.clientesAtivos ? ("down" as const) : ("neutral" as const),
    },
    {
      title: "Base Total",
      value: formatNumber(kpis.baseTotal),
      description: `${formatPct(kpis.baseTotal > 0 ? (kpis.clientesAtivos / kpis.baseTotal) * 100 : 0)} de ativacao`,
      icon: Database,
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            BI Comercial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores comerciais {isAcumulado ? "acumulados ate hoje" : `de ${getMesLabel(mes)}`}/{ano}
          </p>
        </div>

        <BiFilters
          mes={mes}
          ano={ano}
          vendedorFilter={vendedorFilter}
          vendedores={vendedores}
          onMesChange={(newMes) => navigateToMonth(newMes)}
          onAnoChange={(newAno) => navigateToMonth(mes, newAno)}
          onVendedorChange={(v) => setVendedorFilter(v)}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {kpiCards.map((card, index) => (
          <KpiCard key={card.title} index={index} {...card} />
        ))}
      </div>

      {/* Top 20 Clientes */}
      <TopClientesSection
        top20Geral={top20Geral}
        top20VI={top20VI}
        mes={mes}
        ano={ano}
      />

      {/* Indicador 1: Pedidos por Vendedor */}
      <PedidosVendedorSection
        pedidosVendedor={pedidosVendedor}
        pedidosVendedorPrev={pedidosVendedorPrev}
        vendedorFilter={vendedorFilter}
        isAcumulado={isAcumulado}
        mes={mes}
        ano={ano}
      />

      {/* Indicador 2: Pedidos por Regiao */}
      <PedidosRegiaoSection
        pedidosRegiao={pedidosRegiao}
        mes={mes}
        ano={ano}
      />

      {/* Indicador 3: Base Ativa por Vendedor */}
      <BaseAtivaSection
        clientesStatus={clientesStatus}
        vendedorFilter={vendedorFilter}
      />

      {/* Indicador 4: Lista de Inativos */}
      <ClientesInativosSection
        clientesInativos={clientesInativos}
        vendedorFilter={vendedorFilter}
      />

      {/* Indicador 5: Evolucao Faturamento por Produto */}
      <ProdutosEvolucaoSection evolucao={evolucao} mes={mes} ano={ano} />

      {/* Indicador 6: Demonstrativo por Cliente */}
      <DemoClienteSection
        clientesB2B={clientesB2B}
        mesInicio={isAcumulado ? 1 : mes}
        mesFim={isAcumulado ? new Date().getMonth() + 1 : mes}
        ano={ano}
      />
    </div>
  );
}
