/** Mostra quando os pedidos foram atualizados pela última vez. Usado nas telas
 *  admin e comercial. O /pedidos é sincronizado fora da Vercel (bloqueio de IP),
 *  então este selo deixa o time saber a frescura da base. */
export function PedidosLastSync({ lastSync }: { lastSync: string | null }) {
  if (!lastSync) return null;
  const formatted = new Date(lastSync).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Pedidos atualizados em {formatted}
    </p>
  );
}
