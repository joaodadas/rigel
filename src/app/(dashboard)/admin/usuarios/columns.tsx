"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toggleBanAction } from "./actions"

export type UserRow = {
  id: string
  name: string
  email: string
  role?: string
  banned?: boolean | null
  banReason?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  comercial: "Comercial",
  financeiro: "Financeiro",
  rh: "RH",
}

const roleColorMap: Record<string, string> = {
  admin: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  comercial: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  financeiro: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rh: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
}

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

function StatusCell({ row }: { row: { original: UserRow } }) {
  const user = row.original
  if (user.banned) {
    const date = new Date(user.updatedAt).toLocaleDateString("pt-BR")
    return (
      <div>
        <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          Inativo
        </Badge>
        <span className="text-[11px] text-muted-foreground block mt-0.5">
          em {date}
        </span>
      </div>
    )
  }
  return (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      Ativo
    </Badge>
  )
}

function ActionsCell({ row }: { row: { original: UserRow } }) {
  const user = row.original
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setPending(true)
    await toggleBanAction(user.id, !user.banned)
    router.refresh()
    setPending(false)
  }

  return (
    <Button
      variant={user.banned ? "outline" : "destructive"}
      size="sm"
      onClick={handleToggle}
      disabled={pending}
    >
      {pending ? "..." : user.banned ? "Reativar" : "Inativar"}
    </Button>
  )
}

export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Nome" />,
    cell: ({ row }) => (
      <span className="font-medium whitespace-nowrap">{row.getValue("name")}</span>
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SortableHeader column={column} label="Email" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {row.getValue("email")}
      </span>
    ),
  },
  {
    accessorKey: "role",
    header: ({ column }) => <SortableHeader column={column} label="Perfil" />,
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      return (
        <Badge variant="outline" className={roleColorMap[role] ?? ""}>
          {roleLabelMap[role] ?? role}
        </Badge>
      )
    },
  },
  {
    id: "status",
    accessorFn: (row) => (row.banned ? "Inativo" : "Ativo"),
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: StatusCell,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} label="Criado em" />,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums whitespace-nowrap">
        {new Date(row.getValue("createdAt")).toLocaleDateString("pt-BR")}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ActionsCell,
  },
]
