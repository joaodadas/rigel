"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { NotaFiscalRow } from "@/lib/queries/notas-fiscais"
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

export const columns: ColumnDef<NotaFiscalRow>[] = [
  {
    accessorKey: "id_venda",
    header: ({ column }) => <SortableHeader column={column} label="#NF-e" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums whitespace-nowrap">
        {row.getValue("id_venda")}
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
        <SortableHeader column={column} label="Valor" />
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
      const status = row.getValue("status_pedido") as string | null
      if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>
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
    accessorKey: "nota_emitida",
    header: ({ column }) => <SortableHeader column={column} label="Emitida" />,
    cell: ({ row }) => {
      const emitida = row.getValue("nota_emitida") as string | null
      if (!emitida) return <span className="text-muted-foreground">{"\u2014"}</span>
      return (
        <Badge variant={emitida === "Sim" ? "default" : "secondary"}>
          {emitida}
        </Badge>
      )
    },
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
