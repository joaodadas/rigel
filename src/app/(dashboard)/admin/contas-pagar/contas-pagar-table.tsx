"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import type { ContaPagarRow } from "@/lib/queries/contas-pagar"
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas"
import { columns as allColumns } from "./columns"
import { DataTable } from "@/components/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ContasPagarTableProps {
  data: ContaPagarRow[]
  total: number
  page: number
  pageSize: number
  search: string
  empresas: EmpresaSlug[]
}

const SELECT_ALL_VALUE = "__all__"

export function ContasPagarTable({
  data,
  total,
  page,
  pageSize,
  search,
  empresas,
}: ContasPagarTableProps) {
  const router = useRouter()

  // Estado conceitual do select: 1 empresa → mostra essa; 0 ou >=2 → "Todos".
  const selectedValue: string = empresas.length === 1 ? empresas[0] : SELECT_ALL_VALUE

  // Esconde a coluna "Empresa" quando o filtro está restrito a uma única empresa.
  const columns = useMemo(
    () => empresas.length === 1
      ? allColumns.filter((c) => (c as { accessorKey?: string }).accessorKey !== "empresa")
      : allColumns,
    [empresas.length],
  )

  function buildHref(params: Record<string, string | undefined>): string {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `?${qs}` : "?"
  }

  function navigate(newPage?: number, newSearch?: string) {
    router.push(
      buildHref({
        search: newSearch !== undefined ? newSearch : search,
        page: newSearch !== undefined ? "1" : newPage ? String(newPage) : undefined,
        pageSize: String(pageSize),
        empresa: empresas.length === 1 ? empresas[0] : undefined,
      }),
    )
  }

  function onEmpresaChange(value: string | null) {
    router.push(
      buildHref({
        search: search || undefined,
        page: "1",
        pageSize: String(pageSize),
        empresa: value === SELECT_ALL_VALUE || value === null ? undefined : value,
      }),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selectedValue} onValueChange={onEmpresaChange}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_ALL_VALUE}>Todos os CNPJs</SelectItem>
            {EMPRESAS.map((e) => (
              <SelectItem key={e.slug} value={e.slug}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Buscar por nome da conta..."
        serverTotal={total}
        serverPage={page}
        serverPageSize={pageSize}
        serverSearch={search}
        onServerNavigate={navigate}
      />
    </div>
  )
}
