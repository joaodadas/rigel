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
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/utils/csv";
import type { ClienteVendedorStatus } from "@/lib/queries/comercial-analytics";
import { formatNumber, formatPct } from "./formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BaseAtivaSectionProps {
  clientesStatus: ClienteVendedorStatus[];
  vendedorFilter: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BaseAtivaSection({
  clientesStatus,
  vendedorFilter,
}: BaseAtivaSectionProps) {
  // Filter by vendedor
  const filtered = useMemo(
    () =>
      vendedorFilter === "todos"
        ? clientesStatus
        : clientesStatus.filter((c) => c.vendedor === vendedorFilter),
    [clientesStatus, vendedorFilter]
  );

  // Sort by pctAtivacao ASC (worst first)
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.pctAtivacao - b.pctAtivacao),
    [filtered]
  );

  // Aggregate totals
  const totals = useMemo(() => {
    const agg = filtered.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        ativos: acc.ativos + c.ativos,
        inativos: acc.inativos + c.inativos,
      }),
      { total: 0, ativos: 0, inativos: 0 }
    );
    return {
      ...agg,
      pctAtivacao: agg.total > 0 ? (agg.ativos / agg.total) * 100 : 0,
    };
  }, [filtered]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Base Ativa por Vendedor
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
                "base-ativa-vendedor",
                sorted.map((c) => ({
                  Vendedor: c.vendedor,
                  Total: c.total,
                  Ativos: c.ativos,
                  Inativos: c.inativos,
                  "% Ativacao": c.pctAtivacao,
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
        {/* A) Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatNumber(totals.total)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ativos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatNumber(totals.ativos)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Inativos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatNumber(totals.inativos)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              % Ativacao
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatPct(totals.pctAtivacao)}
            </p>
          </div>
        </div>

        {/* B) Grid of vendedor cards */}
        {sorted.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <div
                key={c.vendedor}
                className="rounded-lg border border-border/50 p-4 space-y-2"
              >
                <p className="font-bold text-sm truncate">{c.vendedor}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Total {formatNumber(c.total)} | Ativos{" "}
                  {formatNumber(c.ativos)} | Inativos{" "}
                  {formatNumber(c.inativos)}
                </p>
                <div className="flex items-center gap-2">
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
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-900">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${c.pctAtivacao}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum dado disponivel
          </p>
        )}
      </CardContent>
    </Card>
  );
}
