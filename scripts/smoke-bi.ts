// Smoke test das queries do BI Comercial pós-Fase 1-6.
// Confirma que os números fazem sentido após a normalização e exclusão de marketplaces.

import {
  getComercialKPIs,
  getPedidosPorVendedor,
  getTopClientes,
  getClientesAtivosVendedor,
  getClientesInativos,
} from "../src/lib/queries/comercial-analytics"

async function main() {
  const ano = 2026

  console.log("=== KPIs Acumulado Jan→Abr/2026 ===")
  const kpis = await getComercialKPIs(1, 4, ano)
  console.log(kpis)

  console.log("\n=== KPIs Apenas Abril/2026 ===")
  const kpisMes = await getComercialKPIs(4, 4, ano)
  console.log(kpisMes)

  console.log("\n=== Pedidos por Vendedor — Acumulado 2026 (top 10) ===")
  const vend = await getPedidosPorVendedor(1, 4, ano)
  vend.slice(0, 10).forEach((v) =>
    console.log(
      `  ${v.tipo.padEnd(15)} | ${v.vendedor.padEnd(22)} | R$ ${v.valorTotal.toLocaleString("pt-BR")} | meta R$ ${v.meta.toLocaleString("pt-BR")} | ${v.pctMeta.toFixed(1)}% | Δ ${v.deltaMesAnterior?.toFixed(1) ?? "—"}%`,
    ),
  )
  console.log(`  ... total de ${vend.length} vendedores únicos`)

  console.log("\n=== Top 5 Clientes Geral — Abril/2026 ===")
  const topG = await getTopClientes(4, 4, ano, "geral", 5)
  topG.forEach((c) =>
    console.log(
      `  #${c.posicao} ${c.cliente.padEnd(40)} | ${c.vendedor.padEnd(15)} | R$ ${c.valorTotal.toLocaleString("pt-BR")} | ${c.qtdPedidos} pedidos`,
    ),
  )

  console.log("\n=== Top 5 Vendas Internas — Acumulado 2026 ===")
  const topI = await getTopClientes(1, 4, ano, "vendas_internas", 5)
  topI.forEach((c) =>
    console.log(
      `  #${c.posicao} ${c.cliente.padEnd(40)} | R$ ${c.valorTotal.toLocaleString("pt-BR")} | ${c.qtdPedidos} pedidos`,
    ),
  )

  console.log("\n=== Status clientes por vendedor (top 5) ===")
  const status = await getClientesAtivosVendedor()
  status.slice(0, 5).forEach((s) =>
    console.log(
      `  ${s.vendedor.padEnd(22)} | ${s.total} clientes | ${s.ativos} ativos | ${s.inativos} inativos | ${s.pctAtivacao.toFixed(1)}%`,
    ),
  )

  console.log("\n=== Inativos (head 5, ordenado por dias desc) ===")
  const inat = await getClientesInativos()
  console.log(`  Total inativos: ${inat.length}`)
  inat.slice(0, 5).forEach((c) =>
    console.log(
      `  ${c.nome.padEnd(40)} | ${c.vendedor.padEnd(15)} | últ ${c.ultimoPedido} | ${c.diasSemCompra}d`,
    ),
  )

  // === Filtro server-side por vendedor ===
  console.log("\n=== KPIs APENAS Edwilson — Acumulado 2026 ===")
  const kE = await getComercialKPIs(1, 4, ano, "Edwilson")
  console.log(kE)

  console.log("\n=== Top 5 clientes do Edwilson — Acumulado 2026 ===")
  const topE = await getTopClientes(1, 4, ano, "geral", 5, "Edwilson")
  topE.forEach((c) =>
    console.log(
      `  #${c.posicao} ${c.cliente.padEnd(40)} | ${c.vendedor.padEnd(12)} | R$ ${c.valorTotal.toLocaleString("pt-BR")}`,
    ),
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
