"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { NotaFiscalRow } from "@/lib/queries/notas-fiscais"
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

export const columns: ColumnDef<NotaFiscalRow>[] = [
  {
    accessorKey: "id_venda",
    header: ({ column }) => <SortableHeader column={column} label="#NF-e" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">
        {row.getValue("id_venda")}
      </span>
    ),
  },
  {
    accessorKey: "serie_nota",
    header: ({ column }) => <SortableHeader column={column} label="Serie" />,
    cell: ({ row }) => {
      const serie = row.getValue("serie_nota") as number | null
      return (
        <span className="font-mono text-xs tabular-nums">
          {serie != null ? serie : "\u2014"}
        </span>
      )
    },
  },
  {
    accessorKey: "nome_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Cliente" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("nome_cliente")}</span>
    ),
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
    accessorKey: "nota_chave",
    header: ({ column }) => <SortableHeader column={column} label="Chave" />,
    cell: ({ row }) => {
      const chave = row.getValue("nota_chave") as string | null
      if (!chave) return <span className="text-muted-foreground">{"\u2014"}</span>
      return (
        <span className="font-mono text-xs text-muted-foreground" title={chave}>
          {chave.length > 20 ? `${chave.slice(0, 20)}...` : chave}
        </span>
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
