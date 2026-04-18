"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESES_OPTIONS = [
  { value: 0, label: "Acumulado" },
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
] as const;

const VENDAS_INTERNAS_NAME = "Vendas Internas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getMesLabel(mes: number): string {
  const found = MESES_OPTIONS.find((m) => m.value === mes);
  return found?.label ?? String(mes);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BiFiltersProps {
  mes: number; // 0 = acumulado, 1-12 = month
  ano: number;
  vendedorFilter: string;
  vendedores: string[]; // normalized vendedor names
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  onVendedorChange: (vendedor: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BiFilters({
  mes,
  ano,
  vendedorFilter,
  vendedores,
  onMesChange,
  onAnoChange,
  onVendedorChange,
}: BiFiltersProps) {
  // Split vendedores into Vendas Internas and Representantes
  const vendasInternas = vendedores.filter((v) => v === VENDAS_INTERNAS_NAME);
  const representantes = vendedores.filter((v) => v !== VENDAS_INTERNAS_NAME);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Month selector */}
      <Select
        value={String(mes)}
        onValueChange={(v) => onMesChange(Number(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {MESES_OPTIONS.map((m) => (
            <SelectItem key={m.value} value={String(m.value)}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year selector */}
      <Select
        value={String(ano)}
        onValueChange={(v) => onAnoChange(Number(v))}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectItem value="2025">2025</SelectItem>
          <SelectItem value="2026">2026</SelectItem>
        </SelectContent>
      </Select>

      {/* Vendedor selector */}
      <Select
        value={vendedorFilter}
        onValueChange={(v) => onVendedorChange(v ?? "todos")}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectItem value="todos">Todos os vendedores</SelectItem>

          {vendasInternas.length > 0 && (
            <>
              <SelectSeparator />
              <SelectItem value="__header_vi" disabled>
                {"--- Vendas Internas ---"}
              </SelectItem>
              {vendasInternas.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </>
          )}

          {representantes.length > 0 && (
            <>
              <SelectSeparator />
              <SelectItem value="__header_rep" disabled>
                {"--- Representantes ---"}
              </SelectItem>
              {representantes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
