"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { OrcamentoRow } from "@/lib/queries/orcamentos"
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

export const columns: ColumnDef<OrcamentoRow>[] = [
  {
    accessorKey: "id_orcamento",
    header: ({ column }) => <SortableHeader column={column} label="#Orcamento" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums whitespace-nowrap">
        {row.getValue("id_orcamento")}
      </span>
    ),
  },
  {
    accessorKey: "nome_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Cliente" />,
    cell: ({ row }) => {
      const raw = row.getValue("nome_cliente") as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[250px] truncate block font-medium whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "valor_total_nota",
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader column={column} label="Valor Total" />
      </div>
    ),
    cell: ({ row }) => {
      const valor = row.getValue("valor_total_nota") as number | null
      if (valor == null) return <span className="text-muted-foreground text-right block">{"\u2014"}</span>
      return (
        <span className="tabular-nums font-mono text-sm text-right block whitespace-nowrap">
          {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      )
    },
  },
  {
    accessorKey: "status_pedido",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const status = row.getValue("status_pedido") as string
      const styles: Record<string, string> = {
        "Em Aberto": "",
        "Em Andamento": "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        "Atendido": "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        "Cancelado": "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      }
      const className = styles[status]
      return (
        <Badge variant={className ? "outline" : "secondary"} className={className}>
          {status || "\u2014"}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "data_pedido",
    header: ({ column }) => <SortableHeader column={column} label="Data" />,
    cell: ({ row }) => {
      const dateStr = row.getValue("data_pedido") as string | null
      if (!dateStr) return <span className="text-muted-foreground">{"\u2014"}</span>
      try {
        const date = new Date(dateStr)
        return (
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
            {date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        )
      } catch {
        return <span className="text-muted-foreground">{dateStr}</span>
      }
    },
  },
]
