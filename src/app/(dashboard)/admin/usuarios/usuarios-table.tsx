"use client"

import { useState } from "react"
import type { UserRow } from "./columns"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { CreateUserSheet } from "./create-user-sheet"

type StatusFilter = "todos" | "ativos" | "inativos"

export function UsuariosTable({ data }: { data: UserRow[] }) {
  const [status, setStatus] = useState<StatusFilter>("todos")
  const [sheetOpen, setSheetOpen] = useState(false)

  const filtered = data.filter((u) => {
    if (status === "ativos") return !u.banned
    if (status === "inativos") return !!u.banned
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => setSheetOpen(true)} className="ml-auto">
          <Plus className="size-4" />
          Novo Usuário
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="name"
        searchPlaceholder="Buscar por nome..."
      />

      <CreateUserSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
