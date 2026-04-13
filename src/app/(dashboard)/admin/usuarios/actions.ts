"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

type ActionResult = { success: true } | { success: false; error: string }

export async function createUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const role = formData.get("role") as string

    if (!name || !email || !password || !role) {
      return { success: false, error: "Todos os campos são obrigatórios" }
    }

    await auth.api.createUser({
      headers: await headers(),
      body: { name, email, password, role: role as "admin" | "comercial" | "financeiro" | "rh" },
    })

    revalidatePath("/admin/usuarios")
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar usuário"
    return { success: false, error: msg }
  }
}

export async function toggleBanAction(userId: string, ban: boolean): Promise<ActionResult> {
  try {
    const h = await headers()
    if (ban) {
      await auth.api.banUser({ headers: h, body: { userId } })
    } else {
      await auth.api.unbanUser({ headers: h, body: { userId } })
    }
    revalidatePath("/admin/usuarios")
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar status"
    return { success: false, error: msg }
  }
}
