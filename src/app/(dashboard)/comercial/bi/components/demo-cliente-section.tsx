"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Download, Loader2, Search } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCsv } from "@/lib/utils/csv";
import type {
  ClienteB2B,
  DemonstrativoCliente,
} from "@/lib/queries/comercial-analytics";
import { formatBRL } from "./formatters";

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

interface DemoClienteSectionProps {
  clientesB2B: ClienteB2B[];
  mesInicio: number;
  mesFim: number;
  ano: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DemoClienteSection({
  clientesB2B,
  mesInicio,
  mesFim,
  ano,
}: DemoClienteSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [data, setData] = useState<DemonstrativoCliente | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter clients by search term
  const filteredClientes = useMemo(() => {
    if (!searchTerm.trim()) return clientesB2B.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return clientesB2B
      .filter((c) => c.nome.toLowerCase().includes(term))
      .slice(0, 50);
  }, [clientesB2B, searchTerm]);

  // Fetch data when client or period changes
  useEffect(() => {
    if (!clienteId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(
      `/api/bi/demo-cliente?clienteId=${clienteId}&mesInicio=${mesInicio}&mesFim=${mesFim}&ano=${ano}`
    )
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [clienteId, mesInicio, mesFim, ano]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Select a client
  function handleSelectCliente(c: ClienteB2B) {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setSearchTerm(c.nome);
    setDropdownOpen(false);
  }

  // Sorted month keys from data
  const monthKeys = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    for (const p of data.produtos) {
      for (const m of Object.keys(p.meses)) {
        keys.add(m);
      }
    }
    return Array.from(keys).sort();
  }, [data]);

  // CSV export
  function handleExportCsv() {
    if (!data) return;
    const rows = data.produtos.map((prod) => {
      const obj: Record<string, unknown> = { Produto: prod.descProduto };
      for (const m of monthKeys) {
        obj[mesLabel(m)] = prod.meses[m] ?? 0;
      }
      obj["Total"] = prod.total;
      return obj;
    });

    // Add totals row
    const totalsRow: Record<string, unknown> = { Produto: "TOTAL" };
    for (const m of monthKeys) {
      totalsRow[mesLabel(m)] = data.totaisMes[m] ?? 0;
    }
    totalsRow["Total"] = data.totalGeral;
    rows.push(totalsRow);

    exportToCsv(`demonstrativo-${clienteNome}-${mesInicio}-${mesFim}-${ano}`, rows);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Demonstrativo por Cliente
            </CardTitle>
            <CardDescription>
              Historico de compras por produto e mes
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Client search */}
            <div ref={containerRef} className="relative">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setDropdownOpen(true);
                    if (!e.target.value.trim()) {
                      setClienteId(null);
                      setClienteNome("");
                    }
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  className="w-[260px] pl-7"
                />
              </div>

              {dropdownOpen && filteredClientes.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
                  {filteredClientes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelectCliente(c)}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CSV export */}
            {data && data.produtos.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleExportCsv}>
                <Download className="mr-1 size-3.5" />
                CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Empty state */}
        {!clienteId && !loading && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Selecione um cliente
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando...
          </div>
        )}

        {/* Data loaded but empty */}
        {clienteId && !loading && data && data.produtos.length === 0 && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Nenhum dado encontrado para este cliente no periodo
          </div>
        )}

        {/* Pivot table */}
        {clienteId && !loading && data && data.produtos.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Produto
                  </TableHead>
                  {monthKeys.map((m) => (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.produtos.map((prod) => (
                  <TableRow key={prod.idProduto} className="hover:bg-muted/50">
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {prod.descProduto}
                    </TableCell>
                    {monthKeys.map((m) => (
                      <TableCell key={m} className="text-right tabular-nums">
                        {prod.meses[m] ? formatBRL(prod.meses[m]) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatBRL(prod.total)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/50">
                  <TableCell>Total</TableCell>
                  {monthKeys.map((m) => (
                    <TableCell key={m} className="text-right tabular-nums">
                      {data.totaisMes[m] ? formatBRL(data.totaisMes[m]) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(data.totalGeral)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
