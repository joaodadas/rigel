"use client"

import type { ProdutoRow } from "@/lib/queries/produtos"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface ProdutosTableProps {
  data: ProdutoRow[]
}

export function ProdutosTable({ data }: ProdutosTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="desc_produto"
      searchPlaceholder="Buscar por produto..."
    />
  )
}
