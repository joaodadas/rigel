"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  DollarSign,
  Target,
  TrendingUp,
  Receipt,
  Users,
  UserX,
  Database,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Select components now used via BiFilters
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { exportToCsv } from "@/lib/utils/csv";
import type {
  ComercialKPIs,
  PedidoVendedor,
  PedidoRegiao,
  ClienteVendedorStatus,
  ClienteInativo,
  ProdutoEvolucao,
  TopCliente,
} from "@/lib/queries/comercial-analytics";
import { BiFilters, getMesLabel } from "./components/bi-filters";
import { PedidosVendedorSection } from "./components/pedidos-vendedor-section";
import { BaseAtivaSection } from "./components/base-ativa-section";
import { ClientesInativosSection } from "./components/clientes-inativos-section";
import {
  formatBRL,
  formatBRLFull,
  formatNumber,
  formatPct,
  ChartTooltipContent,
} from "./components/formatters";

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

const MESES_CURTOS: Record<string, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

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
  top20Geral: _top20Geral,
  top20VI: _top20VI,
  pedidosVendedorPrev,
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

  // Evolucao line chart
  const evolucaoChart = useMemo(
    () =>
      evolucao.map((e) => {
        const [, mm] = e.mes.split("-");
        return {
          mes: MESES_CURTOS[mm] ?? e.mes,
          faturamento: e.faturamento,
        };
      }),
    [evolucao]
  );

  // Evolucao table with variation
  const evolucaoTable = useMemo(() => {
    return evolucao.map((e, i) => {
      const prev = i > 0 ? evolucao[i - 1].faturamento : null;
      const variacao =
        prev !== null && prev > 0
          ? ((e.faturamento - prev) / prev) * 100
          : null;
      const [, mm] = e.mes.split("-");
      return {
        mes: MESES_CURTOS[mm] ?? e.mes,
        mesFull: e.mes,
        faturamento: e.faturamento,
        variacao,
      };
    });
  }, [evolucao]);

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
    <div className="space-y-8">
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Pedidos por Regiao
              </CardTitle>
              <CardDescription>
                Distribuicao por UF ordenada por valor
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `pedidos-regiao-${mes}-${ano}`,
                  pedidosRegiao.map((p) => ({
                    UF: p.uf,
                    "Valor Total": p.valorTotal,
                    "Qtd Pedidos": p.qtdPedidos,
                  }))
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    UF
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Valor Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Qtd Pedidos
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosRegiao.map((p) => (
                  <TableRow key={p.uf} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{p.uf}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.valorTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.qtdPedidos)}
                    </TableCell>
                  </TableRow>
                ))}
                {pedidosRegiao.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Nenhum dado disponivel
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

      {/* Indicador 5: Evolucao Faturamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Evolucao do Faturamento
          </CardTitle>
          <CardDescription>
            Faturamento mensal dos ultimos 6 meses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Line Chart */}
          {evolucaoChart.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={evolucaoChart}
                margin={{ left: 20, right: 20, top: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatBRL(v)}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="faturamento"
                  stroke="var(--color-foreground)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-foreground)" }}
                  activeDot={{ r: 6 }}
                  name="Faturamento"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Mes
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Faturamento
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Variacao
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evolucaoTable.map((e) => (
                  <TableRow key={e.mesFull} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{e.mes}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(e.faturamento)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.variacao !== null ? (
                        <span
                          className={
                            e.variacao >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {e.variacao >= 0 ? "+" : ""}
                          {formatPct(e.variacao)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {evolucaoTable.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Nenhum dado disponivel
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
