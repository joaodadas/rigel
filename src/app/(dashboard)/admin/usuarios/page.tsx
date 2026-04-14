import { getSession, auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UsuariosTable } from "./usuarios-table"

export default async function UsuariosPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const result = await auth.api.listUsers({
    headers: await headers(),
    query: { limit: 200, offset: 0 },
  })

  // Serialize Date objects so they can be passed to the client component
  const users = result.users.map((u) => ({
    ...u,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os usuários do sistema
        </p>
      </div>
      <UsuariosTable data={users} />
    </div>
  )
}
