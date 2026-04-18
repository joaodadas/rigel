"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCsv } from "@/lib/utils/csv";
import type { PedidoVendedor } from "@/lib/queries/comercial-analytics";
import {
  formatBRL,
  formatNumber,
  formatPct,
  ChartTooltipContent,
} from "./formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PedidosVendedorSectionProps {
  pedidosVendedor: PedidoVendedor[];
  pedidosVendedorPrev: PedidoVendedor[] | null;
  vendedorFilter: string; // "todos" or specific vendedor name
  isAcumulado: boolean;
  mes: number;
  ano: number;
}

interface BarChartItem {
  vendedor: string;
  valorTotal: number;
  meta: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateVendedor(name: string, max = 18): string {
  return name.length > max ? name.slice(0, max) + "..." : name;
}

function buildBarChartData(items: PedidoVendedor[]): BarChartItem[] {
  return items.map((p) => ({
    vendedor: truncateVendedor(p.vendedor),
    valorTotal: p.valorTotal,
    meta: p.meta,
  }));
}

function VendedorBarChart({ data }: { data: BarChartItem[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(300, data.length * 44)}
    >
      <BarChart
        data={data}
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
  );
}

// ---------------------------------------------------------------------------
// Table row component
// ---------------------------------------------------------------------------

function VendedorTableRow({
  p,
  delta,
  showDelta,
}: {
  p: PedidoVendedor;
  delta: number | null;
  showDelta: boolean;
}) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{p.vendedor}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(p.qtdPedidos)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatBRL(p.valorTotal)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatBRL(p.ticketMedio)}
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
      {showDelta && (
        <TableCell className="text-right tabular-nums">
          {delta !== null ? (
            <span
              className={
                delta >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {delta >= 0 ? "+" : ""}
              {formatPct(delta)}
            </span>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PedidosVendedorSection({
  pedidosVendedor,
  pedidosVendedorPrev,
  vendedorFilter,
  isAcumulado,
  mes,
  ano,
}: PedidosVendedorSectionProps) {
  // 1. Filter by vendedorFilter
  const filtered = useMemo(
    () =>
      vendedorFilter === "todos"
        ? pedidosVendedor
        : pedidosVendedor.filter((p) => p.vendedor === vendedorFilter),
    [pedidosVendedor, vendedorFilter]
  );

  // 2. Separate Vendas Internas vs Representantes
  const { vendasInternas, representantes } = useMemo(() => {
    const vi: PedidoVendedor[] = [];
    const reps: PedidoVendedor[] = [];
    for (const p of filtered) {
      if (p.vendedor === "Vendas Internas") {
        vi.push(p);
      } else {
        reps.push(p);
      }
    }
    // 3. Sort representantes by valorTotal DESC
    reps.sort((a, b) => b.valorTotal - a.valorTotal);
    return { vendasInternas: vi, representantes: reps };
  }, [filtered]);

  // 4. Top 10 and others
  const top10 = representantes.slice(0, 10);
  const others = representantes.slice(10);

  // Build chart data
  const viChartData = useMemo(
    () => buildBarChartData(vendasInternas),
    [vendasInternas]
  );
  const top10ChartData = useMemo(() => buildBarChartData(top10), [top10]);

  // 6. Delta map
  const prevMap = useMemo(() => {
    const m = new Map<string, number>();
    if (pedidosVendedorPrev) {
      for (const p of pedidosVendedorPrev) {
        m.set(p.vendedor, p.valorTotal);
      }
    }
    return m;
  }, [pedidosVendedorPrev]);

  const getDelta = (vendedor: string, current: number): number | null => {
    const prev = prevMap.get(vendedor);
    return prev && prev > 0 ? ((current - prev) / prev) * 100 : null;
  };

  const showDelta = !isAcumulado;

  // Table header columns
  const tableHeaders = (
    <TableRow className="hover:bg-transparent">
      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Vendedor
      </TableHead>
      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Pedidos
      </TableHead>
      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Valor (R$)
      </TableHead>
      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Ticket Medio
      </TableHead>
      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Meta Mes
      </TableHead>
      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
        % Ating.
      </TableHead>
      {showDelta && (
        <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Delta vs Anterior
        </TableHead>
      )}
    </TableRow>
  );

  const colCount = showDelta ? 7 : 6;

  return (
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
                filtered.map((p) => ({
                  Vendedor: p.vendedor,
                  "Qtd Pedidos": p.qtdPedidos,
                  "Valor Total": p.valorTotal,
                  "Ticket Medio": p.ticketMedio,
                  Meta: p.meta,
                  "% Meta": p.pctMeta,
                  ...(showDelta
                    ? {
                        "Delta vs Anterior": (() => {
                          const d = getDelta(p.vendedor, p.valorTotal);
                          return d !== null
                            ? `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`
                            : "";
                        })(),
                      }
                    : {}),
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
        {/* Vendas Internas section */}
        {vendasInternas.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Vendas Internas
            </h3>
            <VendedorBarChart data={viChartData} />
          </div>
        )}

        {/* Representantes section */}
        {top10.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Representantes{" "}
              {representantes.length > 10
                ? `(Top 10 de ${representantes.length})`
                : `(${representantes.length})`}
            </h3>
            <VendedorBarChart data={top10ChartData} />
          </div>
        )}

        {/* Others (collapsible) */}
        {others.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Outros representantes ({others.length})
            </summary>
            <div className="mt-4">
              <VendedorBarChart data={buildBarChartData(others)} />
            </div>
          </details>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>{tableHeaders}</TableHeader>
            <TableBody>
              {/* Vendas Internas rows */}
              {vendasInternas.map((p) => (
                <VendedorTableRow
                  key={p.vendedor}
                  p={p}
                  delta={getDelta(p.vendedor, p.valorTotal)}
                  showDelta={showDelta}
                />
              ))}
              {/* Representantes rows (top 10) */}
              {top10.map((p) => (
                <VendedorTableRow
                  key={p.vendedor}
                  p={p}
                  delta={getDelta(p.vendedor, p.valorTotal)}
                  showDelta={showDelta}
                />
              ))}
              {/* Others rows */}
              {others.map((p) => (
                <VendedorTableRow
                  key={p.vendedor}
                  p={p}
                  delta={getDelta(p.vendedor, p.valorTotal)}
                  showDelta={showDelta}
                />
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
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
  );
}
