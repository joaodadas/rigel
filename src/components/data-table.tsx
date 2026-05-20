"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  /** Server-side pagination props (when provided, disables client-side search) */
  serverTotal?: number
  serverPage?: number
  serverPageSize?: number
  serverSearch?: string
  onServerNavigate?: (newPage?: number, newSearch?: string) => void
  /** Conteúdo extra renderizado à esquerda do campo de busca, na mesma linha. */
  toolbarLeft?: React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Buscar...",
  serverTotal,
  serverPage,
  serverPageSize,
  serverSearch,
  onServerNavigate,
  toolbarLeft,
}: DataTableProps<TData, TValue>) {
  const isServerPaginated = serverTotal !== undefined && onServerNavigate !== undefined
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: isServerPaginated ? (serverPageSize ?? 50) : 10,
      },
    },
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          {toolbarLeft}
          {isServerPaginated ? (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                defaultValue={serverSearch ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onServerNavigate(undefined, (e.target as HTMLInputElement).value)
                  }
                }}
                className="h-9 bg-muted/50 pl-8"
              />
            </div>
          ) : searchKey ? (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
                }
                className="h-9 bg-muted/50 pl-8"
              />
            </div>
          ) : null}
        </div>

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="ml-auto h-9 min-w-[40px]">
                <SlidersHorizontal className="size-3.5" />
                <span className="hidden sm:inline">Colunas</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Colunas visiveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <Table className="min-w-0">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border/50 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border/50 hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: Row count + Pagination */}
      {isServerPaginated ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm tabular-nums text-muted-foreground">
            {serverTotal} resultado(s)
          </p>

          <div className="flex items-center gap-4">
            {/* Page info */}
            <span className="text-sm tabular-nums text-muted-foreground">
              {serverPage} de{" "}
              {Math.ceil(serverTotal / (serverPageSize ?? 50))}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[40px] min-w-[40px] active:scale-[0.96]"
                onClick={() => onServerNavigate((serverPage ?? 1) - 1)}
                disabled={(serverPage ?? 1) <= 1}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Pagina anterior</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[40px] min-w-[40px] active:scale-[0.96]"
                onClick={() => onServerNavigate((serverPage ?? 1) + 1)}
                disabled={(serverPage ?? 1) >= Math.ceil(serverTotal / (serverPageSize ?? 50))}
              >
                <ChevronRight className="size-4" />
                <span className="sr-only">Proxima pagina</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm tabular-nums text-muted-foreground">
            {table.getFilteredRowModel().rows.length} resultado(s)
          </p>

          <div className="flex items-center gap-4">
            {/* Rows per page */}
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">Linhas</span>
              <Select
                value={table.getState().pagination.pageSize}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger size="sm" className="h-8 w-[70px] min-w-[40px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" alignItemWithTrigger={false}>
                  {[10, 20, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page info */}
            <span className="text-sm tabular-nums text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} de{" "}
              {table.getPageCount()}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[40px] min-w-[40px] active:scale-[0.96]"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Pagina anterior</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-[40px] min-w-[40px] active:scale-[0.96]"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="size-4" />
                <span className="sr-only">Proxima pagina</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
