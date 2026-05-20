"use client"

import { useRouter } from "next/navigation"
import type { ContaPagarRow } from "@/lib/queries/contas-pagar"
import {
  EMPRESAS,
  getEmpresaNome,
  isEmpresaSlug,
  type EmpresaSlug,
} from "@/lib/empresas"
import { columns } from "./columns"
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

  const empresaSelect = (
    <Select value={selectedValue} onValueChange={onEmpresaChange}>
      <SelectTrigger className="h-9 w-[220px]">
        <SelectValue placeholder="Empresa">
          {(value: string | null) => {
            if (value === SELECT_ALL_VALUE || value == null) return "Todos os CNPJs"
            return isEmpresaSlug(value) ? getEmpresaNome(value) : value
          }}
        </SelectValue>
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
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por nome da conta..."
      serverTotal={total}
      serverPage={page}
      serverPageSize={pageSize}
      serverSearch={search}
      onServerNavigate={navigate}
      toolbarLeft={empresaSelect}
    />
  )
}
