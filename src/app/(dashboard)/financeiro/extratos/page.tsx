import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FinanceiroExtratosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Extratos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize os extratos bancarios
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Em breve: visualizacao de extratos bancarios.
        </p>
      </div>
    </div>
  );
}
