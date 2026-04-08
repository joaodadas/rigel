"use client"

import type { PedidoRow } from "@/lib/queries/pedidos"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface PedidosTableProps {
  data: PedidoRow[]
}

export function PedidosTable({ data }: PedidosTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="nome_cliente"
      searchPlaceholder="Buscar por cliente..."
    />
  )
}
