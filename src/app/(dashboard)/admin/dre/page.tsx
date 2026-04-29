import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMesesDisponiveis } from "@/lib/queries/dre";

export default async function DREPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "admin") redirect("/");

  const disponiveis = await getMesesDisponiveis();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">DRE Executivo</h1>
      <p className="text-muted-foreground">Aba Controladoria — em construção (Fase 1: backbone).</p>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium mb-2">Status dos dados</h2>
        {disponiveis ? (
          <p>
            Ano <strong>{disponiveis.ano}</strong> — meses com dados:{" "}
            <strong>{disponiveis.meses.join(", ") || "nenhum"}</strong>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhum upload ainda. Use{" "}
            <code className="px-1 py-0.5 rounded bg-muted">POST /api/dre/upload</code> com{" "}
            <code className="px-1 py-0.5 rounded bg-muted">file</code> (multipart) para popular.
          </p>
        )}
      </section>
    </div>
  );
}
