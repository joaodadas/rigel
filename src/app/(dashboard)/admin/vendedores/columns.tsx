"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { VendedorRow } from "@/lib/queries/vendedores"
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

export const columns: ColumnDef<VendedorRow>[] = [
  {
    accessorKey: "razao_vendedor",
    header: ({ column }) => <SortableHeader column={column} label="Nome" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("razao_vendedor")}</span>
    ),
  },
  {
    accessorKey: "fantasia_vendedor",
    header: ({ column }) => <SortableHeader column={column} label="Fantasia" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("fantasia_vendedor") || "\u2014"}
      </span>
    ),
  },
  {
    id: "localidade",
    accessorFn: (row) => {
      const cidade = row.cidade_vendedor
      const uf = row.uf_vendedor
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
    accessorKey: "fone_vendedor",
    header: ({ column }) => <SortableHeader column={column} label="Telefone" />,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.getValue("fone_vendedor") || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "email_vendedor",
    header: ({ column }) => <SortableHeader column={column} label="Email" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("email_vendedor") || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "comissao_usuario",
    header: ({ column }) => <SortableHeader column={column} label="Comissao" />,
    cell: ({ row }) => {
      const comissao = row.getValue("comissao_usuario") as number | null
      if (comissao == null) return <span className="text-muted-foreground">{"\u2014"}</span>
      return (
        <span className="tabular-nums">
          {comissao.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2,
          })}%
        </span>
      )
    },
  },
  {
    accessorKey: "situacao_vendedor",
    header: ({ column }) => <SortableHeader column={column} label="Situacao" />,
    cell: ({ row }) => {
      const situacao = row.getValue("situacao_vendedor") as string
      return (
        <Badge variant={situacao === "Ativo" ? "default" : "secondary"}>
          {situacao}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]
