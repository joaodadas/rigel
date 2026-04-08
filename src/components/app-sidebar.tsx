"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Receipt,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  List,
  UserCheck,
  Shield,
  LogOut,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  label: string
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry
}

const navByRole: Record<string, NavEntry[]> = {
  admin: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Clientes", url: "/admin/clientes", icon: Users },
    { title: "Pedidos", url: "/admin/pedidos", icon: ShoppingCart },
    { title: "Orçamentos", url: "/admin/orcamentos", icon: FileText },
    { title: "NF-e", url: "/admin/nfe", icon: Receipt },
    { title: "Produtos", url: "/admin/produtos", icon: Package },
    {
      label: "Financeiro",
      items: [
        { title: "Contas a Pagar", url: "/admin/contas-pagar", icon: ArrowDownCircle },
        { title: "Contas a Receber", url: "/admin/contas-receber", icon: ArrowUpCircle },
        { title: "Extratos", url: "/admin/extratos", icon: List },
      ],
    },
    { title: "Vendedores", url: "/admin/vendedores", icon: UserCheck },
    { title: "Usuários", url: "/admin/usuarios", icon: Shield },
  ],
  comercial: [
    { title: "Dashboard", url: "/comercial", icon: LayoutDashboard },
    { title: "Clientes", url: "/comercial/clientes", icon: Users },
    { title: "Pedidos", url: "/comercial/pedidos", icon: ShoppingCart },
    { title: "Orçamentos", url: "/comercial/orcamentos", icon: FileText },
    { title: "NF-e", url: "/comercial/nfe", icon: Receipt },
    { title: "Produtos", url: "/comercial/produtos", icon: Package },
  ],
  financeiro: [
    { title: "Dashboard", url: "/financeiro", icon: LayoutDashboard },
    { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: ArrowDownCircle },
    { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: ArrowUpCircle },
    { title: "Extratos", url: "/financeiro/extratos", icon: List },
  ],
  rh: [
    { title: "Dashboard", url: "/rh", icon: LayoutDashboard },
    { title: "Vendedores", url: "/rh/vendedores", icon: UserCheck },
  ],
}

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  comercial: "Comercial",
  financeiro: "Financeiro",
  rh: "RH",
}

// ---------------------------------------------------------------------------
// Collapsible nav group (Financeiro sub-menu for admin)
// ---------------------------------------------------------------------------

function NavCollapsibleGroup({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  const isGroupActive = group.items.some((item) => pathname === item.url)

  return (
    <Collapsible defaultOpen={isGroupActive}>
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton tooltip={group.label}>
              <ArrowDownCircle className="size-4" />
              <span>{group.label}</span>
              <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton
                  render={<Link href={item.url} />}
                  isActive={pathname === item.url}
                  className={cn(
                    "min-h-[40px]",
                    pathname === item.url &&
                      "bg-amber-500/10 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400"
                  )}
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()

  const role = (session?.user?.role as string) ?? "comercial"
  const userName = session?.user?.name ?? "Usuário"
  const userEmail = session?.user?.email ?? ""
  const navEntries = navByRole[role] ?? navByRole.comercial

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* ----------------------------------------------------------------- */}
      {/* Header: Brand                                                      */}
      {/* ----------------------------------------------------------------- */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="pointer-events-none"
              tooltip="Rigel"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 font-bold text-sm dark:bg-amber-500/20 dark:text-amber-400">
                R
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold tracking-tight">
                  Rigel
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Gestão Empresarial
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ----------------------------------------------------------------- */}
      {/* Navigation                                                         */}
      {/* ----------------------------------------------------------------- */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navEntries.map((entry) => {
                if (isNavGroup(entry)) {
                  return (
                    <NavCollapsibleGroup
                      key={entry.label}
                      group={entry}
                      pathname={pathname}
                    />
                  )
                }

                const isActive = pathname === entry.url

                return (
                  <SidebarMenuItem key={entry.url}>
                    <SidebarMenuButton
                      render={<Link href={entry.url} />}
                      isActive={isActive}
                      tooltip={entry.title}
                      className={cn(
                        "min-h-[40px]",
                        isActive &&
                          "bg-amber-500/10 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400"
                      )}
                    >
                      <entry.icon className="size-4" />
                      <span>{entry.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ----------------------------------------------------------------- */}
      {/* Footer: User info + Theme toggle + Sign out                        */}
      {/* ----------------------------------------------------------------- */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="min-h-[48px]"
                    tooltip={userName}
                  />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-amber-500/15 text-amber-600 text-[10px] font-semibold dark:bg-amber-500/20 dark:text-amber-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {userEmail}
                  </span>
                </div>
                {state === "expanded" && (
                  <Badge variant="secondary" className="ml-auto text-[10px] uppercase tracking-wider">
                    {roleLabelMap[role] ?? role}
                  </Badge>
                )}
                <ChevronsUpDown className="ml-auto size-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-56"
              >
                <div className="flex items-center gap-2 px-2 py-2">
                  <Avatar size="sm">
                    <AvatarFallback className="bg-amber-500/15 text-amber-600 text-[10px] font-semibold dark:bg-amber-500/20 dark:text-amber-400">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
