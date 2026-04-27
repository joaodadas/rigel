"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  ChevronDown,
  Search,
  Trophy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HeatmapBR } from "@/components/dashboard/heatmap-br";
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

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type Modo = "mes" | "acumulado";

interface ComercialDashboardProps {
  kpis: ComercialKPIs;
  pedidosVendedor: PedidoVendedor[];
  pedidosRegiao: PedidoRegiao[];
  clientesStatus: ClienteVendedorStatus[];
  clientesInativos: ClienteInativo[];
  evolucao: ProdutoEvolucao[];
  topGeral: TopCliente[];
  topInternas: TopCliente[];
  defaultMes: number;
  defaultAno: number;
  defaultModo: Modo;
  defaultVendedor: string | null;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatBRLFull = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

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
  { value: 3, label: "Março" },
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
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const FAIXAS_INATIVIDADE = [
  { value: "todas", label: "Todas as faixas" },
  { value: "6-9", label: "6 a 9 meses (180-270d)" },
  { value: "9-12", label: "9 a 12 meses (270-365d)" },
  { value: "12+", label: "12+ meses (>365d)" },
];

// ---------------------------------------------------------------------------
// Tooltip
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
// Tabela vendedores (reutilizada para Internas e Representantes)
// ---------------------------------------------------------------------------

function TabelaVendedores({ rows }: { rows: PedidoVendedor[] }) {
  return (
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
              Ticket Médio
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
            <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Δ vs mês ant.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.vendedor} className="hover:bg-muted/50">
              <TableCell className="font-medium">{p.vendedor}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(p.valorTotal)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(p.ticketMedio)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(p.qtdPedidos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(p.meta)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <Badge
                  variant={
                    p.pctMeta >= 100 ? "default" : p.pctMeta >= 80 ? "secondary" : "destructive"
                  }
                >
                  {formatPct(p.pctMeta)}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.deltaMesAnterior === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span
                    className={
                      p.deltaMesAnterior >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {p.deltaMesAnterior >= 0 ? "+" : ""}
                    {formatPct(p.deltaMesAnterior)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                Nenhum dado disponível
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfico horizontal Realizado vs Meta
// ---------------------------------------------------------------------------

function BarChartVendedor({ rows }: { rows: PedidoVendedor[] }) {
  const data = useMemo(
    () =>
      rows.map((p) => ({
        vendedor: p.vendedor.length > 18 ? p.vendedor.slice(0, 18) + "…" : p.vendedor,
        valorTotal: p.valorTotal,
        meta: p.meta,
      })),
    [rows],
  );
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
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
        <Bar dataKey="valorTotal" fill="var(--color-foreground)" name="Realizado" radius={[0, 4, 4, 0]} barSize={16} />
        <Bar dataKey="meta" fill="var(--color-muted)" name="Meta" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Card de status por vendedor (gauge)
// ---------------------------------------------------------------------------

function VendedorStatusCard({ row }: { row: ClienteVendedorStatus }) {
  const pct = Math.min(100, row.pctAtivacao);
  const tone =
    row.pctAtivacao >= 50
      ? "bg-emerald-500"
      : row.pctAtivacao >= 25
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium truncate">{row.vendedor}</p>
        <Badge
          variant={row.pctAtivacao >= 50 ? "default" : row.pctAtivacao >= 25 ? "secondary" : "destructive"}
          className="shrink-0"
        >
          {formatPct(row.pctAtivacao)}
        </Badge>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="font-semibold tabular-nums">{formatNumber(row.total)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Ativos</p>
          <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatNumber(row.ativos)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Inativos</p>
          <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
            {formatNumber(row.inativos)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela Top Clientes
// ---------------------------------------------------------------------------

function TopClientesTable({ rows }: { rows: TopCliente[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-xs uppercase tracking-wider text-muted-foreground font-medium">#</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cliente</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Vendedor</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">UF</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Valor Total</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Pedidos</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Ticket Médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={`${c.posicao}-${c.cliente}`} className="hover:bg-muted/50">
              <TableCell className="tabular-nums text-muted-foreground">{c.posicao}</TableCell>
              <TableCell className="font-medium max-w-[280px] truncate">{c.cliente}</TableCell>
              <TableCell className="text-muted-foreground">{c.vendedor}</TableCell>
              <TableCell className="text-muted-foreground">{c.uf || "—"}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatBRL(c.valorTotal)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(c.qtdPedidos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(c.ticketMedio)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                Nenhum cliente no período
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ComercialDashboard({
  kpis,
  pedidosVendedor,
  pedidosRegiao,
  clientesStatus,
  clientesInativos,
  evolucao,
  topGeral,
  topInternas,
  defaultMes,
  defaultAno,
  defaultModo,
  defaultVendedor,
}: ComercialDashboardProps) {
  const router = useRouter();
  const mes = defaultMes;
  const ano = defaultAno;
  const modo = defaultModo;
  const vendedorFilter = defaultVendedor ?? "todos";

  const [faixaInatividade, setFaixaInatividade] = useState("todas");
  const [buscaInativo, setBuscaInativo] = useState("");
  const [topTab, setTopTab] = useState<"geral" | "internas">("geral");

  const navigateParams = useCallback(
    (next: { mes?: number; ano?: number; modo?: Modo; vendedor?: string }) => {
      const m = next.mes ?? mes;
      const a = next.ano ?? ano;
      const md = next.modo ?? modo;
      const v = next.vendedor ?? vendedorFilter;
      const params = new URLSearchParams();
      params.set("mes", String(m));
      params.set("ano", String(a));
      params.set("modo", md);
      if (v && v !== "todos") params.set("vendedor", v);
      router.push(`?${params.toString()}`);
    },
    [router, mes, ano, modo, vendedorFilter],
  );

  // Vendedores distintos para o select
  const vendedores = useMemo(() => {
    const names = new Set<string>();
    pedidosVendedor.forEach((p) => names.add(p.vendedor));
    clientesStatus.forEach((c) => names.add(c.vendedor));
    return Array.from(names).sort();
  }, [pedidosVendedor, clientesStatus]);

  // ------------------------------------------------------------- Indicador 1
  const filteredPedidosVendedor = useMemo(
    () =>
      vendedorFilter === "todos"
        ? pedidosVendedor
        : pedidosVendedor.filter((p) => p.vendedor === vendedorFilter),
    [pedidosVendedor, vendedorFilter],
  );

  const internas = useMemo(
    () => filteredPedidosVendedor.filter((p) => p.tipo === "vendas_internas"),
    [filteredPedidosVendedor],
  );
  const representantes = useMemo(
    () =>
      filteredPedidosVendedor
        .filter((p) => p.tipo === "representante" || p.tipo === "outros")
        .sort((a, b) => b.valorTotal - a.valorTotal),
    [filteredPedidosVendedor],
  );
  const repTop10 = representantes.slice(0, 10);
  const repOutros = representantes.slice(10);

  // -------------------------------------------------- Filtros indicador 3+4
  const filteredClientesStatus = useMemo(
    () =>
      vendedorFilter === "todos"
        ? clientesStatus
        : clientesStatus.filter((c) => c.vendedor === vendedorFilter),
    [clientesStatus, vendedorFilter],
  );

  const filteredClientesInativos = useMemo(() => {
    let list = clientesInativos;
    if (vendedorFilter !== "todos") list = list.filter((c) => c.vendedor === vendedorFilter);
    if (faixaInatividade !== "todas") {
      list = list.filter((c) => {
        const d = c.diasSemCompra;
        if (faixaInatividade === "6-9") return d >= 180 && d < 270;
        if (faixaInatividade === "9-12") return d >= 270 && d < 365;
        if (faixaInatividade === "12+") return d >= 365;
        return true;
      });
    }
    if (buscaInativo.trim().length > 0) {
      const q = buscaInativo.trim().toLowerCase();
      list = list.filter((c) => c.nome.toLowerCase().includes(q));
    }
    return list;
  }, [clientesInativos, vendedorFilter, faixaInatividade, buscaInativo]);

  const clientesTotals = useMemo(
    () =>
      filteredClientesStatus.reduce(
        (acc, c) => ({
          total: acc.total + c.total,
          ativos: acc.ativos + c.ativos,
          inativos: acc.inativos + c.inativos,
        }),
        { total: 0, ativos: 0, inativos: 0 },
      ),
    [filteredClientesStatus],
  );

  const sortedClientesStatus = useMemo(
    () => [...filteredClientesStatus].sort((a, b) => a.pctAtivacao - b.pctAtivacao),
    [filteredClientesStatus],
  );

  // --------------------------------------------------------- Evolução (line)
  const evolucaoChart = useMemo(
    () =>
      evolucao.map((e) => {
        const [, mm] = e.mes.split("-");
        return { mes: MESES_CURTOS[mm] ?? e.mes, faturamento: e.faturamento };
      }),
    [evolucao],
  );

  const evolucaoTable = useMemo(() => {
    return evolucao.map((e, i) => {
      const prev = i > 0 ? evolucao[i - 1].faturamento : null;
      const variacao = prev !== null && prev > 0 ? ((e.faturamento - prev) / prev) * 100 : null;
      const [, mm] = e.mes.split("-");
      return { mes: MESES_CURTOS[mm] ?? e.mes, mesFull: e.mes, faturamento: e.faturamento, variacao };
    });
  }, [evolucao]);

  // ----------------------------------------------------------- KPI cards
  const periodoLabel =
    modo === "mes"
      ? `${MESES[mes - 1]?.label ?? mes}/${ano}`
      : `Acumulado até ${MESES[mes - 1]?.label ?? mes}/${ano}`;

  const kpiCards = [
    {
      title: "Faturamento B2B",
      value: formatBRL(kpis.faturamentoB2B),
      description: `${formatNumber(kpis.totalPedidos)} pedidos atendidos`,
      icon: DollarSign,
      trend: "neutral" as const,
    },
    {
      title: "Meta B2B",
      value: formatBRL(kpis.metaB2BAcumulada),
      description: periodoLabel,
      icon: Target,
      trend: "neutral" as const,
    },
    {
      title: "% Atingimento",
      value: formatPct(kpis.pctAtingimento),
      description: kpis.pctAtingimento >= 100 ? "Meta atingida" : "Abaixo da meta",
      icon: TrendingUp,
      trend:
        kpis.pctAtingimento >= 100
          ? ("up" as const)
          : kpis.pctAtingimento >= 80
            ? ("neutral" as const)
            : ("down" as const),
    },
    {
      title: "Ticket Médio",
      value: formatBRLFull(kpis.ticketMedio),
      description: "Valor médio por pedido",
      icon: Receipt,
      trend: "neutral" as const,
    },
    {
      title: "Clientes Ativos",
      value: formatNumber(kpis.clientesAtivos),
      description: "Compraram nos últimos 6 meses",
      icon: Users,
      trend: "neutral" as const,
    },
    {
      title: "Clientes Inativos",
      value: formatNumber(kpis.clientesInativos),
      description: "Sem compra há 6+ meses",
      icon: UserX,
      trend: kpis.clientesInativos > kpis.clientesAtivos ? ("down" as const) : ("neutral" as const),
    },
    {
      title: "Base Total B2B",
      value: formatNumber(kpis.baseTotal),
      description: `${formatPct(kpis.baseTotal > 0 ? (kpis.clientesAtivos / kpis.baseTotal) * 100 : 0)} de ativação`,
      icon: Database,
      trend: "neutral" as const,
    },
  ];

  // --------------------------------------------------------- Top Clientes
  const topData = topTab === "geral" ? topGeral : topInternas;

  return (
    <div className="space-y-8">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BI Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores B2B — {periodoLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Modo Mês × Acumulado */}
          <div className="inline-flex rounded-md border border-border/50 p-0.5">
            <button
              onClick={() => navigateParams({ modo: "mes" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition ${
                modo === "mes" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => navigateParams({ modo: "acumulado" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition ${
                modo === "acumulado" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Acumulado
            </button>
          </div>

          <Select value={String(mes)} onValueChange={(v) => navigateParams({ mes: Number(v) })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(ano)} onValueChange={(v) => navigateParams({ ano: Number(v) })}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {[ano - 1, ano].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={vendedorFilter}
            onValueChange={(v) => navigateParams({ vendedor: v ?? "todos" })}
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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {kpiCards.map((card, index) => (
          <KpiCard key={card.title} index={index} {...card} />
        ))}
      </div>

      {/* Indicador 1: Vendas Internas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Vendas Internas</CardTitle>
              <CardDescription>Aline (VI-01) + Fátima (VI-02) — meta combinada</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `vendas-internas-${mes}-${ano}-${modo}`,
                  internas.map((p) => ({
                    Vendedor: p.vendedor,
                    "Valor Total": p.valorTotal,
                    "Ticket Medio": p.ticketMedio,
                    "Qtd Pedidos": p.qtdPedidos,
                    Meta: p.meta,
                    "% Meta": p.pctMeta,
                    "Delta vs Mes Anterior %": p.deltaMesAnterior,
                  })),
                )
              }
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <BarChartVendedor rows={internas} />
          <TabelaVendedores rows={internas} />
        </CardContent>
      </Card>

      {/* Indicador 1: Representantes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Representantes</CardTitle>
              <CardDescription>
                Top 10 expandido. Demais ({formatNumber(repOutros.length)}) abaixo, colapsados.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `representantes-${mes}-${ano}-${modo}`,
                  representantes.map((p) => ({
                    Vendedor: p.vendedor,
                    "Valor Total": p.valorTotal,
                    "Ticket Medio": p.ticketMedio,
                    "Qtd Pedidos": p.qtdPedidos,
                    Meta: p.meta,
                    "% Meta": p.pctMeta,
                    "Delta vs Mes Anterior %": p.deltaMesAnterior,
                  })),
                )
              }
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <BarChartVendedor rows={repTop10} />
          <TabelaVendedores rows={repTop10} />
          {repOutros.length > 0 && (
            <Collapsible className="space-y-3">
              <CollapsibleTrigger className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
                Mostrar outros {formatNumber(repOutros.length)} representantes
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
                <TabelaVendedores rows={repOutros} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Top 20 Clientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg font-semibold">Top 20 Clientes</CardTitle>
                <CardDescription>
                  Maiores clientes por faturamento — {periodoLabel}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `top20-${topTab}-${mes}-${ano}-${modo}`,
                  topData.map((c) => ({
                    Posicao: c.posicao,
                    Cliente: c.cliente,
                    Vendedor: c.vendedor,
                    UF: c.uf,
                    "Valor Total": c.valorTotal,
                    "Qtd Pedidos": c.qtdPedidos,
                    "Ticket Medio": c.ticketMedio,
                  })),
                )
              }
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="inline-flex rounded-md border border-border/50 p-0.5">
            <button
              onClick={() => setTopTab("geral")}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition ${
                topTab === "geral" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Geral
            </button>
            <button
              onClick={() => setTopTab("internas")}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition ${
                topTab === "internas" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Vendas Internas
            </button>
          </div>
          <TopClientesTable rows={topData} />
        </CardContent>
      </Card>

      {/* Indicador 2: Pedidos por Região */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Pedidos por Região</CardTitle>
              <CardDescription>Distribuição por UF ordenada por valor</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `pedidos-regiao-${mes}-${ano}-${modo}`,
                  pedidosRegiao.map((p) => ({
                    UF: p.uf,
                    "Valor Total": p.valorTotal,
                    "Qtd Pedidos": p.qtdPedidos,
                  })),
                )
              }
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <HeatmapBR data={pedidosRegiao} metric="valor" />
            <div className="overflow-x-auto rounded-lg border border-border/50 self-start">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">UF</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Valor Total</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Qtd Pedidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosRegiao.map((p) => (
                    <TableRow key={p.uf} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{p.uf}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(p.valorTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.qtdPedidos)}</TableCell>
                    </TableRow>
                  ))}
                  {pedidosRegiao.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                        Nenhum dado disponível
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicador 3: Base Ativa por Vendedor (cards) */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg font-semibold">Base Ativa por Vendedor</CardTitle>
            <CardDescription>
              Clientes B2B classificados como ativos (compra ≤ 6 meses) vs. inativos. Ordenados por % ativação ascendente.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedClientesStatus.map((row) => (
              <VendedorStatusCard key={row.vendedor} row={row} />
            ))}
            {sortedClientesStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
            )}
          </div>

          {/* Resumo agregado */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatNumber(clientesTotals.total)}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ativos</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatNumber(clientesTotals.ativos)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Inativos</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatNumber(clientesTotals.inativos)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">% Ativação</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatPct(
                  clientesTotals.total > 0 ? (clientesTotals.ativos / clientesTotals.total) * 100 : 0,
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicador 4: Lista de Inativos (com filtros) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Clientes Inativos</CardTitle>
              <CardDescription>
                Sem compra há 6+ meses — útil para rotina de reativação
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `clientes-inativos-${faixaInatividade}`,
                  filteredClientesInativos.map((c) => ({
                    Cliente: c.nome,
                    Vendedor: c.vendedor,
                    "Ultimo Pedido": c.ultimoPedido ?? "Nunca",
                    "Valor Ultimo Pedido": c.valorUltimoPedido,
                    "Dias sem Compra": c.diasSemCompra,
                  })),
                )
              }
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros locais */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaInativo}
                onChange={(e) => setBuscaInativo(e.target.value)}
                placeholder="Buscar cliente…"
                className="pl-8"
              />
            </div>
            <Select value={faixaInatividade} onValueChange={(v) => setFaixaInatividade(v ?? "todas")}>
              <SelectTrigger className="w-[230px]">
                <SelectValue placeholder="Faixa de inatividade" />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {FAIXAS_INATIVIDADE.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground ml-auto">
              {formatNumber(filteredClientesInativos.length)} clientes
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cliente</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Vendedor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Último Pedido</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Valor</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Dias sem Compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientesInativos.slice(0, 100).map((c, i) => (
                  <TableRow key={`${c.nome}-${i}`} className="hover:bg-muted/50">
                    <TableCell className="max-w-[260px] truncate font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.vendedor}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{c.ultimoPedido ?? "Nunca"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(c.valorUltimoPedido)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant={c.diasSemCompra >= 365 ? "destructive" : "secondary"}>
                        {formatNumber(c.diasSemCompra)}d
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClientesInativos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      Nenhum cliente nos filtros atuais
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredClientesInativos.length > 100 && (
            <p className="text-xs text-muted-foreground">
              Mostrando 100 de {formatNumber(filteredClientesInativos.length)}. Exporte o CSV para a lista completa.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Evolução do Faturamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Evolução do Faturamento B2B</CardTitle>
          <CardDescription>Faturamento mensal dos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {evolucaoChart.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={evolucaoChart} margin={{ left: 20, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Mês</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Faturamento</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evolucaoTable.map((e) => (
                  <TableRow key={e.mesFull} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{e.mes}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(e.faturamento)}</TableCell>
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
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {evolucaoTable.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                      Nenhum dado disponível
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
