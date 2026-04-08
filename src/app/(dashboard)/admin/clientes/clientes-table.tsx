"use client"

import type { ClienteRow } from "@/lib/queries/clientes"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface ClientesTableProps {
  data: ClienteRow[]
}

export function ClientesTable({ data }: ClientesTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="razao_cliente"
      searchPlaceholder="Buscar por razao social..."
    />
  )
}
