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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os usuários do sistema
        </p>
      </div>
      <UsuariosTable data={result.users} />
    </div>
  )
}
