"use client"

import { useRouter } from "next/navigation"
import type { VendedorRow } from "@/lib/queries/vendedores"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"

interface VendedoresTableProps {
  data: VendedorRow[]
  total: number
  page: number
  pageSize: number
  search: string
}

export function VendedoresTable({ data, total, page, pageSize, search }: VendedoresTableProps) {
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
      searchPlaceholder="Buscar por razao social..."
      serverTotal={total}
      serverPage={page}
      serverPageSize={pageSize}
      serverSearch={search}
      onServerNavigate={navigate}
    />
  )
}
