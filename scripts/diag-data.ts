import { Pool } from "pg"

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const counts = await pool.query<{ entity: string; total: string }>(`
      SELECT 'clientes' AS entity, COUNT(*)::text AS total FROM clientes WHERE lixeira = 'Nao'
      UNION ALL
      SELECT 'pedidos',  COUNT(*)::text FROM pedidos  WHERE lixeira = 'Nao'
      UNION ALL
      SELECT 'pedidos_atendidos', COUNT(*)::text FROM pedidos WHERE lixeira = 'Nao' AND status_pedido = 'Atendido'
      UNION ALL
      SELECT 'vendedores', COUNT(*)::text FROM vendedores WHERE lixeira = 'Nao'
      UNION ALL
      SELECT 'produtos',  COUNT(*)::text FROM produtos  WHERE lixeira = 'Nao'
    `)
    console.log("=== Counts ===")
    counts.rows.forEach((r) => console.log(`  ${r.entity}: ${r.total}`))

    const distinctVend = await pool.query<{ vendedor_pedido: string; n: string }>(`
      SELECT vendedor_pedido, COUNT(*)::text AS n
      FROM pedidos
      WHERE lixeira = 'Nao'
      GROUP BY vendedor_pedido
      ORDER BY COUNT(*) DESC
    `)
    console.log(`\n=== Vendedores distintos em pedidos (${distinctVend.rowCount}) ===`)
    distinctVend.rows.forEach((r) => console.log(`  "${r.vendedor_pedido}" — ${r.n} pedidos`))

    const distinctVendCli = await pool.query<{ vendedor_cliente: string; n: string }>(`
      SELECT vendedor_cliente, COUNT(*)::text AS n
      FROM clientes
      WHERE lixeira = 'Nao'
      GROUP BY vendedor_cliente
      ORDER BY COUNT(*) DESC
    `)
    console.log(`\n=== Vendedores distintos em clientes (${distinctVendCli.rowCount}) ===`)
    distinctVendCli.rows.forEach((r) => console.log(`  "${r.vendedor_cliente}" — ${r.n} clientes`))

    const dateRange = await pool.query<{ min: string; max: string }>(`
      SELECT MIN(data_pedido)::text AS min, MAX(data_pedido)::text AS max
      FROM pedidos WHERE lixeira = 'Nao'
    `)
    console.log(`\n=== Range de datas dos pedidos ===`)
    console.log(`  ${dateRange.rows[0].min} → ${dateRange.rows[0].max}`)

    const statusDist = await pool.query<{ status_pedido: string; n: string }>(`
      SELECT status_pedido, COUNT(*)::text AS n
      FROM pedidos WHERE lixeira = 'Nao'
      GROUP BY status_pedido
      ORDER BY COUNT(*) DESC
    `)
    console.log(`\n=== Status dos pedidos ===`)
    statusDist.rows.forEach((r) => console.log(`  "${r.status_pedido}": ${r.n}`))

    const lastSync = await pool.query<{ entity: string; status: string; records_synced: number; created_at: string }>(`
      SELECT entity, status, records_synced, created_at::text
      FROM sync_log
      ORDER BY created_at DESC
      LIMIT 10
    `)
    console.log(`\n=== Últimos 10 syncs ===`)
    lastSync.rows.forEach((r) =>
      console.log(`  ${r.created_at} | ${r.entity} | ${r.status} | ${r.records_synced}`),
    )
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error("Failed:", e)
  process.exit(1)
})
