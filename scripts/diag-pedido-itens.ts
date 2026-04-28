import { Pool } from "pg"

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    const cols = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'pedido_itens'
       ORDER BY ordinal_position`,
    )
    console.log("=== pedido_itens columns ===")
    cols.rows.forEach((r) => console.log(`  ${r.column_name}  (${r.data_type})`))

    const sample = await pool.query("SELECT * FROM pedido_itens LIMIT 3")
    console.log("\n=== sample row ===")
    console.log(JSON.stringify(sample.rows[0] ?? null, null, 2))

    const counts = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM pedido_itens`,
    )
    console.log(`\n=== total rows: ${counts.rows[0].total} ===`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
