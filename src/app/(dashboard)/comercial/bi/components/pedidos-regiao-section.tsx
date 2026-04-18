"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCsv } from "@/lib/utils/csv";
import type { PedidoRegiao } from "@/lib/queries/comercial-analytics";
import { formatBRL, formatNumber, formatPct } from "./formatters";
import { BrazilMap } from "./brazil-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PedidosRegiaoSectionProps {
  pedidosRegiao: PedidoRegiao[];
  mes: number;
  ano: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PedidosRegiaoSection({
  pedidosRegiao,
  mes,
  ano,
}: PedidosRegiaoSectionProps) {
  // Build map data: UF code -> valor total
  const mapData = useMemo(() => {
    const d: Record<string, number> = {};
    for (const p of pedidosRegiao) {
      d[p.uf] = p.valorTotal;
    }
    return d;
  }, [pedidosRegiao]);

  // Total for % calculation
  const totalValor = useMemo(
    () => pedidosRegiao.reduce((sum, p) => sum + p.valorTotal, 0),
    [pedidosRegiao]
  );

  return (
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
                  "Nro Pedidos": p.qtdPedidos,
                  "Valor Total": p.valorTotal,
                  "% do Total":
                    totalValor > 0
                      ? ((p.valorTotal / totalValor) * 100).toFixed(1) + "%"
                      : "0%",
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
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Map (left / top on mobile) */}
          <div className="flex shrink-0 items-start justify-center lg:justify-start">
            <BrazilMap data={mapData} />
          </div>

          {/* Table (right / bottom on mobile) */}
          <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    UF
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Nro Pedidos
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Valor Total
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    % do Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosRegiao.map((p) => {
                  const pct =
                    totalValor > 0 ? (p.valorTotal / totalValor) * 100 : 0;
                  return (
                    <TableRow key={p.uf} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{p.uf}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(p.qtdPedidos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(p.valorTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(pct)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pedidosRegiao.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Nenhum dado disponivel
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
