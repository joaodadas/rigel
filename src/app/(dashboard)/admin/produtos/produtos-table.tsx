"use client"

import { useRouter } from "next/navigation"
import type { ProdutoRow } from "@/lib/queries/produtos"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface ProdutosTableProps {
  data: ProdutoRow[]
  total: number
  page: number
  pageSize: number
  search: string
}

export function ProdutosTable({ data, total, page, pageSize, search }: ProdutosTableProps) {
  const router = useRouter()

  function navigate(newPage?: number, newSearch?: string) {
    const params = new URLSearchParams()
    if (newSearch !== undefined) {
      params.set("search", newSearch)
      params.set("page", "1")
    } else {
      if (search) params.set("search", search)
      if (newPage) params.set("page", String(newPage))
    }
    params.set("pageSize", String(pageSize))
    router.push(`?${params.toString()}`)
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por produto..."
      serverTotal={total}
      serverPage={page}
      serverPageSize={pageSize}
      serverSearch={search}
      onServerNavigate={navigate}
    />
  )
}
