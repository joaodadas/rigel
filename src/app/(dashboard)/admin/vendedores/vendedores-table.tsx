"use client"

import type { VendedorRow } from "@/lib/queries/vendedores"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface VendedoresTableProps {
  data: VendedorRow[]
}

export function VendedoresTable({ data }: VendedoresTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="razao_vendedor"
      searchPlaceholder="Buscar por razao social..."
    />
  )
}
