"use client"

import type { ContaPagarRow } from "@/lib/queries/contas-pagar"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface ContasPagarTableProps {
  data: ContaPagarRow[]
}

export function ContasPagarTable({ data }: ContasPagarTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="nome_conta"
      searchPlaceholder="Buscar por nome da conta..."
    />
  )
}
