import { Pool } from "pg"

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    const vendedores = await pool.query<{
      id_vendedor: string
      razao_vendedor: string
      fantasia_vendedor: string
      situacao_vendedor: string
    }>(
      `SELECT id_vendedor, razao_vendedor, fantasia_vendedor, situacao_vendedor
       FROM vendedores
       WHERE lixeira = 'Nao'
       ORDER BY razao_vendedor`,
    )
    console.log(`=== Vendedores cadastrados (${vendedores.rowCount}) ===`)
    vendedores.rows.forEach((v) =>
      console.log(`  id=${v.id_vendedor} | razao="${v.razao_vendedor}" | fantasia="${v.fantasia_vendedor}" | situacao="${v.situacao_vendedor}"`),
    )

    const byId = await pool.query<{
      vendedor_pedido_id: string
      vendedor_pedido: string
      n: string
      total: string
    }>(
      `SELECT vendedor_pedido_id, vendedor_pedido, COUNT(*)::text AS n,
              SUM(valor_total_nota::numeric)::text AS total
       FROM pedidos
       WHERE lixeira = 'Nao' AND status_pedido = 'Atendido'
         AND data_pedido >= '2026-01-01'
       GROUP BY vendedor_pedido_id, vendedor_pedido
       ORDER BY COUNT(*) DESC
       LIMIT 30`,
    )
    console.log(`\n=== Top 30 vendedores em pedidos 2026 (por id+nome) ===`)
    byId.rows.forEach((r) =>
      console.log(
        `  id=${r.vendedor_pedido_id ?? "null"} | "${r.vendedor_pedido}" | ${r.n} pedidos | R$ ${Number(r.total).toLocaleString("pt-BR")}`,
      ),
    )

    // VENDAS INTERNAS — quais IDs aparecem?
    const vendasInt = await pool.query<{ vendedor_pedido_id: string; vendedor_pedido: string; n: string }>(
      `SELECT vendedor_pedido_id, vendedor_pedido, COUNT(*)::text AS n
       FROM pedidos
       WHERE lixeira = 'Nao'
         AND UPPER(TRIM(vendedor_pedido)) LIKE 'VENDAS%'
       GROUP BY vendedor_pedido_id, vendedor_pedido
       ORDER BY COUNT(*) DESC`,
    )
    console.log(`\n=== Pedidos com vendedor LIKE "VENDAS%" ===`)
    vendasInt.rows.forEach((r) =>
      console.log(`  id=${r.vendedor_pedido_id ?? "null"} | "${r.vendedor_pedido}" | ${r.n}`),
    )

    // Faturamento total 2026 com/sem marketplaces
    const fat = await pool.query<{ rotulo: string; total: string; n: string }>(
      `SELECT 'Total 2026' AS rotulo, SUM(valor_total_nota::numeric)::text AS total, COUNT(*)::text AS n
       FROM pedidos
       WHERE lixeira = 'Nao' AND status_pedido = 'Atendido' AND data_pedido >= '2026-01-01'
       UNION ALL
       SELECT 'Sem marketplaces', SUM(valor_total_nota::numeric)::text, COUNT(*)::text
       FROM pedidos
       WHERE lixeira = 'Nao' AND status_pedido = 'Atendido' AND data_pedido >= '2026-01-01'
         AND UPPER(TRIM(vendedor_pedido)) NOT IN ('MERCADOFULL','MERCADOLIVRE','SHOPEE','SHOPEEFULL','SHEIN','SHOPPE','SHOPEE FULL','MERCADO LIVRE','MERCADO','MER','MERC','FULL','SHOPPE','AMERICANAS','SOPEE')
      `,
    )
    console.log(`\n=== Faturamento 2026 ===`)
    fat.rows.forEach((r) =>
      console.log(`  ${r.rotulo}: ${r.n} pedidos | R$ ${Number(r.total).toLocaleString("pt-BR")}`),
    )
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
