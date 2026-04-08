"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { OrcamentoRow } from "@/lib/queries/orcamentos"
import { Badge } from "@/components/ui/badge"

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
      <span className="font-mono text-xs tabular-nums">
        {row.getValue("id_orcamento")}
      </span>
    ),
  },
  {
    accessorKey: "nome_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Cliente" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("nome_cliente")}</span>
    ),
  },
  {
    accessorKey: "vendedor_pedido",
    header: ({ column }) => <SortableHeader column={column} label="Vendedor" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("vendedor_pedido") || "\u2014"}
      </span>
    ),
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
        <span className="tabular-nums text-right block">
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
      const variantMap: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
        "Em Aberto": "secondary",
        "Em Andamento": "default",
        "Atendido": "outline",
        "Cancelado": "destructive",
      }
      const variant = variantMap[status] ?? "secondary"
      return (
        <Badge
          variant={variant}
          className={status === "Atendido" ? "text-emerald-500" : undefined}
        >
          {status}
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
          <span className="tabular-nums">
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
  {
    accessorKey: "validade_orcamento",
    header: ({ column }) => <SortableHeader column={column} label="Validade" />,
    cell: ({ row }) => {
      const dateStr = row.getValue("validade_orcamento") as string | null
      if (!dateStr) return <span className="text-muted-foreground">{"\u2014"}</span>
      try {
        const date = new Date(dateStr)
        return (
          <span className="tabular-nums">
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
