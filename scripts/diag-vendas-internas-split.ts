import { Pool } from "pg"

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    // Quando o id 266629 (VENDAS INTERNAS 2) começou a operar?
    const por_mes = await pool.query<{
      mes: string
      vendedor_pedido_id: string
      vendedor_pedido: string
      n: string
      total: string
    }>(
      `SELECT SUBSTR(data_pedido::text, 1, 7) AS mes,
              vendedor_pedido_id, vendedor_pedido,
              COUNT(*)::text AS n,
              SUM(valor_total_nota::numeric)::text AS total
       FROM pedidos
       WHERE lixeira = 'Nao' AND status_pedido = 'Atendido'
         AND vendedor_pedido_id IN (207727, 266629)
       GROUP BY mes, vendedor_pedido_id, vendedor_pedido
       ORDER BY mes ASC, vendedor_pedido_id ASC`,
    )
    console.log(`=== VENDAS INTERNAS por mês (ids 207727 e 266629) ===`)
    por_mes.rows.forEach((r) =>
      console.log(
        `  ${r.mes} | id=${r.vendedor_pedido_id} ${r.vendedor_pedido.padEnd(20)} | ${String(r.n).padStart(5)} pedidos | R$ ${Number(r.total).toLocaleString("pt-BR")}`,
      ),
    )

    // Primeira data de cada um
    const primeira = await pool.query<{
      vendedor_pedido_id: string
      primeira_data: string
      ultima_data: string
    }>(
      `SELECT vendedor_pedido_id::text,
              MIN(data_pedido)::text AS primeira_data,
              MAX(data_pedido)::text AS ultima_data
       FROM pedidos
       WHERE lixeira = 'Nao' AND status_pedido = 'Atendido'
         AND vendedor_pedido_id IN (207727, 266629)
       GROUP BY vendedor_pedido_id`,
    )
    console.log(`\n=== Primeira/última atividade ===`)
    primeira.rows.forEach((r) =>
      console.log(`  id=${r.vendedor_pedido_id} | primeira=${r.primeira_data} | última=${r.ultima_data}`),
    )

    // Algum pedido com nome "VENDAS INTERNAS 1"? (para saber se vai migrar tudo)
    const vi1 = await pool.query<{ vendedor_pedido_id: string; vendedor_pedido: string; n: string }>(
      `SELECT vendedor_pedido_id::text, vendedor_pedido, COUNT(*)::text AS n
       FROM pedidos
       WHERE UPPER(TRIM(vendedor_pedido)) LIKE '%VENDAS INTERNAS 1%'
          OR UPPER(TRIM(vendedor_pedido)) LIKE '%VENDAS INTERNA 1%'
          OR UPPER(TRIM(vendedor_pedido)) LIKE '%VI 1%'
          OR UPPER(TRIM(vendedor_pedido)) LIKE '%VI-1%'
       GROUP BY vendedor_pedido_id, vendedor_pedido`,
    )
    console.log(`\n=== Variantes de "VENDAS INTERNAS 1" ===`)
    if (vi1.rowCount === 0) console.log(`  (nenhuma — ID 207727 continua sendo só "VENDAS INTERNAS")`)
    vi1.rows.forEach((r) =>
      console.log(`  id=${r.vendedor_pedido_id} | "${r.vendedor_pedido}" | ${r.n}`),
    )
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
