"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { ClienteRow } from "@/lib/queries/clientes"
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

export const columns: ColumnDef<ClienteRow>[] = [
  {
    accessorKey: "razao_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Razao Social" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("razao_cliente")}</span>
    ),
  },
  {
    accessorKey: "fantasia_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Fantasia" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("fantasia_cliente") || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "cnpj_cliente",
    header: ({ column }) => <SortableHeader column={column} label="CNPJ/CPF" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">
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
    cell: ({ getValue }) => (
      <span>{(getValue() as string) || "\u2014"}</span>
    ),
  },
  {
    accessorKey: "fone_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Telefone" />,
    cell: ({ row }) => (
      <span className="tabular-nums">
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
  {
    accessorKey: "data_cad_cliente",
    header: ({ column }) => <SortableHeader column={column} label="Cadastro" />,
    cell: ({ row }) => {
      const dateStr = row.getValue("data_cad_cliente") as string | null
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
