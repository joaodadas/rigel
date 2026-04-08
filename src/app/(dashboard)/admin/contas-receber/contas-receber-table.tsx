"use client"

import type { ContaReceberRow } from "@/lib/queries/contas-receber"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface ContasReceberTableProps {
  data: ContaReceberRow[]
}

export function ContasReceberTable({ data }: ContasReceberTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="nome_conta"
      searchPlaceholder="Buscar por nome da conta..."
    />
  )
}
