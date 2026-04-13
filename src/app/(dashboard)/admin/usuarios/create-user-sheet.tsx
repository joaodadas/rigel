"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createUserAction } from "./actions"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserSheet({ open, onOpenChange }: Props) {
  const [role, setRole] = useState("comercial")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set("role", role)

    const result = await createUserAction(formData)

    if (result.success) {
      onOpenChange(false)
      router.refresh()
    } else {
      setError(result.error)
    }
    setPending(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo Usuário</SheetTitle>
          <SheetDescription>
            Crie um novo usuário para acessar o sistema
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 flex-1">
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Nome</Label>
            <Input
              id="create-name"
              name="name"
              placeholder="Nome completo"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              name="email"
              type="email"
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-password">Senha</Label>
            <Input
              id="create-password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <SheetFooter className="mt-auto">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Criando..." : "Criar Usuário"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
