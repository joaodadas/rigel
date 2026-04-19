"use client";

import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCsv } from "@/lib/utils/csv";
import type { ProdutoEvolucao } from "@/lib/queries/comercial-analytics";
import { formatBRL, formatPct, ChartTooltipContent } from "./formatters";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

function mesLabel(mes: string): string {
  const [, mm] = mes.split("-");
  return MESES_CURTOS[mm] ?? mes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProdutosEvolucaoSectionProps {
  evolucao: ProdutoEvolucao[];
  mes: number;
  ano: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProdutosEvolucaoSection({
  evolucao,
  mes,
  ano,
}: ProdutosEvolucaoSectionProps) {
  const [selectedProduct, setSelectedProduct] = useState("todos");

  // Unique sorted month labels
  const monthLabels = useMemo(
    () => Array.from(new Set(evolucao.map((e) => e.mes))).sort(),
    [evolucao]
  );

  // Products sorted by total faturamento DESC
  const productsSorted = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of evolucao) {
      totals.set(e.produto, (totals.get(e.produto) ?? 0) + e.faturamento);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [evolucao]);

  // Grouped data: product -> month -> faturamento
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of evolucao) {
      if (!map[e.produto]) map[e.produto] = {};
      map[e.produto][e.mes] = (map[e.produto][e.mes] ?? 0) + e.faturamento;
    }
    return map;
  }, [evolucao]);

  // Chart data
  const chartData = useMemo(() => {
    if (selectedProduct === "todos") {
      // Sum all products per month
      const sumByMonth: Record<string, number> = {};
      for (const e of evolucao) {
        sumByMonth[e.mes] = (sumByMonth[e.mes] ?? 0) + e.faturamento;
      }
      return monthLabels.map((m) => ({
        mes: mesLabel(m),
        faturamento: sumByMonth[m] ?? 0,
      }));
    }

    // Single product
    const productData = grouped[selectedProduct] ?? {};
    return monthLabels.map((m) => ({
      mes: mesLabel(m),
      faturamento: productData[m] ?? 0,
    }));
  }, [selectedProduct, evolucao, monthLabels, grouped]);

  // Pivot table rows (only for "todos")
  const pivotRows = useMemo(() => {
    if (selectedProduct !== "todos") return [];

    return productsSorted.map((produto) => {
      const byMonth = grouped[produto] ?? {};
      const total = monthLabels.reduce((s, m) => s + (byMonth[m] ?? 0), 0);

      // Var % = last vs second-to-last month
      let variacao: number | null = null;
      if (monthLabels.length >= 2) {
        const lastVal = byMonth[monthLabels[monthLabels.length - 1]] ?? 0;
        const prevVal = byMonth[monthLabels[monthLabels.length - 2]] ?? 0;
        if (prevVal > 0) {
          variacao = ((lastVal - prevVal) / prevVal) * 100;
        }
      }

      return { produto, byMonth, total, variacao };
    });
  }, [selectedProduct, productsSorted, grouped, monthLabels]);

  // CSV export handler
  const handleExportCsv = () => {
    const rows = pivotRows.map((row) => {
      const obj: Record<string, unknown> = { Produto: row.produto };
      for (const m of monthLabels) {
        obj[mesLabel(m)] = row.byMonth[m] ?? 0;
      }
      obj["Total"] = row.total;
      obj["Var. %"] = row.variacao !== null ? row.variacao.toFixed(1) + "%" : "-";
      return obj;
    });
    exportToCsv(`evolucao-produtos-${mes}-${ano}`, rows);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Evolucao do Faturamento
            </CardTitle>
            <CardDescription>
              Faturamento mensal por produto (ultimos meses)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Product selector */}
            <Select
              value={selectedProduct}
              onValueChange={(v) => setSelectedProduct(v ?? "todos")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="todos">Todos (Top 20)</SelectItem>
                {productsSorted.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CSV export — only when pivot table is visible */}
            {selectedProduct === "todos" && pivotRows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleExportCsv}>
                <Download className="mr-1 size-3.5" />
                CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Line Chart */}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={chartData}
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

        {/* Pivot Table — only for "Todos" */}
        {selectedProduct === "todos" && (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Produto
                  </TableHead>
                  {monthLabels.map((m) => (
                    <TableHead
                      key={m}
                      className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium"
                    >
                      {mesLabel(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Var. %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pivotRows.map((row) => (
                  <TableRow key={row.produto} className="hover:bg-muted/50">
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {row.produto}
                    </TableCell>
                    {monthLabels.map((m) => (
                      <TableCell key={m} className="text-right tabular-nums">
                        {formatBRL(row.byMonth[m] ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatBRL(row.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.variacao !== null ? (
                        <span
                          className={
                            row.variacao >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {row.variacao >= 0 ? "+" : ""}
                          {formatPct(row.variacao)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {pivotRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={monthLabels.length + 3}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Nenhum dado disponivel
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Simple table when single product is selected */}
        {selectedProduct !== "todos" && (
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
                {chartData.map((e, i) => {
                  const prev = i > 0 ? chartData[i - 1].faturamento : null;
                  const variacao =
                    prev !== null && prev > 0
                      ? ((e.faturamento - prev) / prev) * 100
                      : null;
                  return (
                    <TableRow key={e.mes} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{e.mes}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(e.faturamento)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {variacao !== null ? (
                          <span
                            className={
                              variacao >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {variacao >= 0 ? "+" : ""}
                            {formatPct(variacao)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {chartData.length === 0 && (
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
        )}
      </CardContent>
    </Card>
  );
}
