"use client";

import { useState } from "react";
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
import type { TopCliente } from "@/lib/queries/comercial-analytics";
import { formatBRL, formatNumber } from "./formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopClientesSectionProps {
  top20Geral: TopCliente[];
  top20VI: TopCliente[];
  mes: number;
  ano: number;
}

type TabKey = "geral" | "vi";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopClientesSection({
  top20Geral,
  top20VI,
  mes,
  ano,
}: TopClientesSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("geral");

  const data = activeTab === "geral" ? top20Geral : top20VI;
  const tabLabel = activeTab === "geral" ? "Geral" : "Vendas Internas";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Top 20 Clientes
            </CardTitle>
            <CardDescription>
              Maiores clientes por faturamento ({tabLabel})
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab toggle */}
            <div className="flex gap-1">
              <Button
                variant={activeTab === "geral" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("geral")}
              >
                Geral
              </Button>
              <Button
                variant={activeTab === "vi" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("vi")}
              >
                Vendas Internas
              </Button>
            </div>

            {/* CSV export */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                exportToCsv(
                  `top20-clientes-${activeTab}-${mes}-${ano}`,
                  data.map((c) => ({
                    "#": c.posicao,
                    Cliente: c.nome,
                    Vendedor: c.vendedor,
                    "Valor Total": c.valorTotal,
                    Pedidos: c.qtdPedidos,
                    "Ticket Medio": c.ticketMedio,
                    UF: c.uf,
                  }))
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-center text-xs uppercase tracking-wider text-muted-foreground font-medium w-12">
                  #
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Cliente
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Vendedor
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Valor Total
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Pedidos
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Ticket Medio
                </TableHead>
                <TableHead className="text-center text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  UF
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={`${c.posicao}-${c.nome}`} className="hover:bg-muted/50">
                  <TableCell className="text-center">
                    <Badge variant="outline" className="tabular-nums">
                      {c.posicao}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.vendedor}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(c.valorTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(c.qtdPedidos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(c.ticketMedio)}
                  </TableCell>
                  <TableCell className="text-center">{c.uf}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
