"use client"

import type { OrcamentoRow } from "@/lib/queries/orcamentos"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface OrcamentosTableProps {
  data: OrcamentoRow[]
}

export function OrcamentosTable({ data }: OrcamentosTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="nome_cliente"
      searchPlaceholder="Buscar por cliente..."
    />
  )
}
