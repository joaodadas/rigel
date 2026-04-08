"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { ProdutoRow } from "@/lib/queries/produtos"
import { Badge } from "@/components/ui/badge"
import { fixEncoding } from "@/lib/utils/text"

function SortableHeader({
  column,
  label,
}: {
  column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => false | "asc" | "desc" }
  label: string
}) {
  return (
    <button
      className="flex items-center gap-1 text-xs uppercase tracking-wider font-medium hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

export const columns: ColumnDef<ProdutoRow>[] = [
  {
    accessorKey: "cod_produto",
    header: ({ column }) => <SortableHeader column={column} label="Codigo" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums whitespace-nowrap">
        {row.getValue("cod_produto") || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "desc_produto",
    header: ({ column }) => <SortableHeader column={column} label="Produto" />,
    cell: ({ row }) => {
      const raw = row.getValue("desc_produto") as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[300px] truncate block font-medium whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "estoque_produto",
    header: ({ column }) => <SortableHeader column={column} label="Estoque" />,
    cell: ({ row }) => {
      const estoque = row.getValue("estoque_produto") as number | null
      if (estoque == null) return <span className="text-muted-foreground">{"\u2014"}</span>
      let colorClass = "text-emerald-500"
      if (estoque < 10) colorClass = "text-red-500"
      else if (estoque < 50) colorClass = "text-orange-500"
      return (
        <span className={`tabular-nums font-mono text-sm ${colorClass}`}>
          {estoque}
        </span>
      )
    },
  },
  {
    accessorKey: "valor_produto",
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader column={column} label="Valor" />
      </div>
    ),
    cell: ({ row }) => {
      const valor = row.getValue("valor_produto") as number | null
      if (valor == null) return <span className="text-muted-foreground text-right block">{"\u2014"}</span>
      return (
        <span className="tabular-nums font-mono text-sm text-right block whitespace-nowrap">
          {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      )
    },
  },
  {
    accessorKey: "status_produto",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const status = row.getValue("status_produto") as string
      return (
        <Badge variant={status === "Ativo" ? "default" : "destructive"}>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]
