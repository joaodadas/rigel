"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
} from "@/lib/queries/comercial-analytics";

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
  defaultMes: number;
  defaultAno: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatBRLFull = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatPct = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";

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
// Chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-card-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          <span
            className="mr-1.5 inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatBRL(entry.value)}
        </p>
      ))}
    </div>
  );
}

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
  defaultMes,
  defaultAno,
}: ComercialDashboardProps) {
  const [mes] = useState(defaultMes);
  const [ano] = useState(defaultAno);
  const [vendedorFilter, setVendedorFilter] = useState("todos");

  // Distinct vendedores for filter
  const vendedores = useMemo(() => {
    const names = new Set<string>();
    pedidosVendedor.forEach((p) => names.add(p.vendedor));
    clientesStatus.forEach((c) => names.add(c.vendedor));
    return Array.from(names).sort();
  }, [pedidosVendedor, clientesStatus]);

  // Filtered data
  const filteredPedidosVendedor = useMemo(
    () =>
      vendedorFilter === "todos"
        ? pedidosVendedor
        : pedidosVendedor.filter((p) => p.vendedor === vendedorFilter),
    [pedidosVendedor, vendedorFilter]
  );

  const filteredClientesStatus = useMemo(
    () =>
      vendedorFilter === "todos"
        ? clientesStatus
        : clientesStatus.filter((c) => c.vendedor === vendedorFilter),
    [clientesStatus, vendedorFilter]
  );

  const filteredClientesInativos = useMemo(
    () =>
      vendedorFilter === "todos"
        ? clientesInativos
        : clientesInativos.filter((c) => c.vendedor === vendedorFilter),
    [clientesInativos, vendedorFilter]
  );

  // Chart data for vendedor comparison
  const barChartData = useMemo(
    () =>
      filteredPedidosVendedor.map((p) => ({
        vendedor:
          p.vendedor.length > 18
            ? p.vendedor.slice(0, 18) + "..."
            : p.vendedor,
        valorTotal: p.valorTotal,
        meta: p.meta,
      })),
    [filteredPedidosVendedor]
  );

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

  // Totals for clientes
  const clientesTotals = useMemo(() => {
    return filteredClientesStatus.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        ativos: acc.ativos + c.ativos,
        inativos: acc.inativos + c.inativos,
      }),
      { total: 0, ativos: 0, inativos: 0 }
    );
  }, [filteredClientesStatus]);

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
      description: `Meta ate ${MESES[mes - 1]?.label ?? mes}/${ano}`,
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
            Indicadores comerciais - {MESES[mes - 1]?.label ?? mes}/{ano}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={vendedorFilter}
            onValueChange={(v) => setVendedorFilter(v ?? "todos")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map((card, index) => (
          <KpiCard key={card.title} index={index} {...card} />
        ))}
      </div>

      {/* Indicador 1: Pedidos por Vendedor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Pedidos por Vendedor
              </CardTitle>
              <CardDescription>
                Realizado vs Meta por vendedor no periodo
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `pedidos-vendedor-${mes}-${ano}`,
                  filteredPedidosVendedor.map((p) => ({
                    Vendedor: p.vendedor,
                    "Valor Total": p.valorTotal,
                    "Ticket Medio": p.ticketMedio,
                    "Qtd Pedidos": p.qtdPedidos,
                    Meta: p.meta,
                    "% Meta": p.pctMeta,
                  }))
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bar Chart */}
          {barChartData.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(300, barChartData.length * 44)}>
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ left: 120, right: 20, top: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatBRL(v)}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="vendedor"
                  width={110}
                  tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="valorTotal"
                  fill="var(--color-foreground)"
                  name="Realizado"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="meta"
                  fill="var(--color-muted)"
                  name="Meta"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Vendedor
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Valor Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Ticket Medio
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Pedidos
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Meta
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    % Meta
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidosVendedor.map((p) => (
                  <TableRow key={p.vendedor} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{p.vendedor}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.valorTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.ticketMedio)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.qtdPedidos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.meta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge
                        variant={
                          p.pctMeta >= 100
                            ? "default"
                            : p.pctMeta >= 80
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {formatPct(p.pctMeta)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPedidosVendedor.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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

      {/* Indicador 3+4: Clientes Ativos/Inativos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Clientes Ativos e Inativos
              </CardTitle>
              <CardDescription>
                Status de ativacao por vendedor (ultimos 6 meses)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `clientes-inativos-${mes}-${ano}`,
                  filteredClientesInativos.map((c) => ({
                    Cliente: c.nome,
                    Vendedor: c.vendedor,
                    "Ultimo Pedido": c.ultimoPedido ?? "Nunca",
                    "Valor Ultimo Pedido": c.valorUltimoPedido,
                    "Dias sem Compra": c.diasSemCompra,
                  }))
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatNumber(clientesTotals.total)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Ativos
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatNumber(clientesTotals.ativos)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Inativos
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatNumber(clientesTotals.inativos)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                % Ativacao
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatPct(
                  clientesTotals.total > 0
                    ? (clientesTotals.ativos / clientesTotals.total) * 100
                    : 0
                )}
              </p>
            </div>
          </div>

          {/* Table: status per vendedor */}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Vendedor
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Ativos
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Inativos
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    % Ativacao
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientesStatus.map((c) => (
                  <TableRow key={c.vendedor} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{c.vendedor}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatNumber(c.ativos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                      {formatNumber(c.inativos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge
                        variant={
                          c.pctAtivacao >= 50
                            ? "default"
                            : c.pctAtivacao >= 25
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {formatPct(c.pctAtivacao)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClientesStatus.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Nenhum dado disponivel
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table: inactive clients */}
          {filteredClientesInativos.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Clientes inativos ({formatNumber(filteredClientesInativos.length)})
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Cliente
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Vendedor
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Ultimo Pedido
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Valor
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                        Dias sem Compra
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientesInativos.slice(0, 50).map((c, i) => (
                      <TableRow key={`${c.nome}-${i}`} className="hover:bg-muted/50">
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {c.nome}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.vendedor}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {c.ultimoPedido ?? "Nunca"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(c.valorUltimoPedido)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.diasSemCompra >= 9999 ? (
                            <Badge variant="destructive">Nunca comprou</Badge>
                          ) : (
                            <span>{formatNumber(c.diasSemCompra)}d</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredClientesInativos.length > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mostrando 50 de {formatNumber(filteredClientesInativos.length)}.
                  Exporte o CSV para ver todos.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
