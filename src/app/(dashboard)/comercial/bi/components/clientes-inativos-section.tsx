"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, Search } from "lucide-react";
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
import type { ClienteInativo } from "@/lib/queries/comercial-analytics";
import { formatBRL, formatNumber } from "./formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientesInativosSectionProps {
  clientesInativos: ClienteInativo[];
  vendedorFilter: string;
}

type InactivityRange = "todos" | "6-9" | "9-12" | "12+";

const PAGE_SIZE = 50;

const RANGE_OPTIONS: { value: InactivityRange; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "6-9", label: "6-9 meses" },
  { value: "9-12", label: "9-12 meses" },
  { value: "12+", label: "12+ meses" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClientesInativosSection({
  clientesInativos,
  vendedorFilter,
}: ClientesInativosSectionProps) {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<InactivityRange>("todos");
  const [page, setPage] = useState(1);

  // Filter data
  const filtered = useMemo(() => {
    let data =
      vendedorFilter === "todos"
        ? clientesInativos
        : clientesInativos.filter((c) => c.vendedor === vendedorFilter);

    if (search) {
      const term = search.toLowerCase();
      data = data.filter((c) => c.nome.toLowerCase().includes(term));
    }

    if (range === "6-9") {
      data = data.filter(
        (c) => c.diasSemCompra >= 180 && c.diasSemCompra < 270
      );
    } else if (range === "9-12") {
      data = data.filter(
        (c) => c.diasSemCompra >= 270 && c.diasSemCompra < 365
      );
    } else if (range === "12+") {
      data = data.filter((c) => c.diasSemCompra >= 365);
    }

    return data;
  }, [clientesInativos, vendedorFilter, search, range]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, range, vendedorFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const startRow = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Clientes Inativos
            </CardTitle>
            <CardDescription>
              Lista de clientes sem compra ha 6+ meses
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              exportToCsv(
                "clientes-inativos",
                filtered.map((c) => ({
                  Cliente: c.nome,
                  Vendedor: c.vendedor,
                  "Ultimo Pedido": c.ultimoPedido ?? "Nunca",
                  "Valor Ultimo Pedido": c.valorUltimoPedido,
                  "Dias sem Compra":
                    c.diasSemCompra >= 9999
                      ? "Nunca comprou"
                      : c.diasSemCompra,
                  Cidade: c.cidade,
                  UF: c.uf,
                }))
              )
            }
          >
            <Download className="mr-1 size-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-64"
            />
          </div>

          {/* Range filter buttons */}
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={range === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setRange(opt.value);
                  setPage(1);
                }}
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
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
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Cidade/UF
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((c, i) => (
                <TableRow
                  key={`${c.nome}-${i}`}
                  className="hover:bg-muted/50"
                >
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
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {c.cidade}/{c.uf}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-16 text-center text-muted-foreground"
                  >
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Mostrando {formatNumber(startRow)}-{formatNumber(endRow)} de{" "}
              {formatNumber(filtered.length)} clientes
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Proximo
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
