"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { ContaPagarRow } from "@/lib/queries/contas-pagar"
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

function formatBRL(value: number | null): string {
  if (value == null) return "\u2014"
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function isOverdue(vencimento: string | null, liquidado: string): boolean {
  if (!vencimento || liquidado === "Sim") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const venc = new Date(vencimento)
  return venc < today
}

export const columns: ColumnDef<ContaPagarRow>[] = [
  {
    accessorKey: "nome_conta",
    header: ({ column }) => <SortableHeader column={column} label="Conta" />,
    cell: ({ row }) => {
      const raw = row.getValue("nome_conta") as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[200px] truncate block font-medium whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "nome_fornecedor",
    header: ({ column }) => <SortableHeader column={column} label="Fornecedor" />,
    cell: ({ row }) => {
      const raw = row.getValue("nome_fornecedor") as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[200px] truncate block text-muted-foreground whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "vencimento_pag",
    header: ({ column }) => <SortableHeader column={column} label="Vencimento" />,
    cell: ({ row }) => {
      const dateStr = row.getValue("vencimento_pag") as string | null
      if (!dateStr) return <span className="text-muted-foreground">{"\u2014"}</span>
      const overdue = isOverdue(dateStr, row.original.liquidado_pag)
      try {
        const date = new Date(dateStr)
        return (
          <span className={`text-sm tabular-nums whitespace-nowrap ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
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
    accessorKey: "valor_pag",
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader column={column} label="Valor" />
      </div>
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-mono text-sm text-right block whitespace-nowrap">
        {formatBRL(row.getValue("valor_pag"))}
      </span>
    ),
  },
  {
    accessorKey: "liquidado_pag",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const liquidado = row.getValue("liquidado_pag") as string
      return liquidado === "Sim" ? (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Liquidado
        </Badge>
      ) : (
        <Badge variant="secondary">Pendente</Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]
