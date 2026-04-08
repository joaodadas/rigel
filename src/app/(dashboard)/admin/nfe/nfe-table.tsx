"use client"

import type { NotaFiscalRow } from "@/lib/queries/notas-fiscais"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface NfeTableProps {
  data: NotaFiscalRow[]
}

export function NfeTable({ data }: NfeTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="nome_cliente"
      searchPlaceholder="Buscar por cliente..."
    />
  )
}
