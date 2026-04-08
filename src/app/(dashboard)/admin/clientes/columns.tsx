"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { ClienteRow } from "@/lib/queries/clientes"
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

export const columns: ColumnDef<ClienteRow>[] = [
  {
    accessorKey: "razao_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Razao Social" />,
    cell: ({ row }) => {
      const raw = row.getValue("razao_cliente") as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[250px] truncate block font-medium whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "cnpj_cliente",
    header: ({ column }) => <SortableHeader column={column} label="CNPJ/CPF" />,
    cell: ({ row }) => (
      <span className="max-w-[160px] font-mono text-xs tabular-nums whitespace-nowrap">
        {row.getValue("cnpj_cliente") || "\u2014"}
      </span>
    ),
  },
  {
    id: "localidade",
    accessorFn: (row) => {
      const cidade = row.cidade_cliente
      const uf = row.uf_cliente
      if (cidade && uf) return `${cidade} - ${uf}`
      if (cidade) return cidade
      if (uf) return uf
      return null
    },
    header: ({ column }) => <SortableHeader column={column} label="Cidade/UF" />,
    cell: ({ getValue }) => {
      const raw = getValue() as string | null
      const text = fixEncoding(raw)
      return (
        <span className="max-w-[180px] truncate block whitespace-nowrap" title={text}>
          {text}
        </span>
      )
    },
  },
  {
    accessorKey: "fone_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Telefone" />,
    cell: ({ row }) => (
      <span className="max-w-[140px] text-sm tabular-nums whitespace-nowrap">
        {row.getValue("fone_cliente") || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "situacao_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Situacao" />,
    cell: ({ row }) => {
      const situacao = row.getValue("situacao_cliente") as string
      return (
        <Badge variant={situacao === "Ativo" ? "default" : "destructive"}>
          {situacao}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]
