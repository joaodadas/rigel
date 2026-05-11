import { Pool } from "pg"

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    const r = await pool.query(
      `SELECT id_vendedor, razao_vendedor, fantasia_vendedor, tipo_pessoa,
              cnpj_vendedor, email_vendedor, fone_vendedor, celular_vendedor,
              situacao_vendedor, data_cad_vendedor, data_mod_vendedor, lixeira
       FROM vendedores
       WHERE id_vendedor IN (207727, 266629)
       ORDER BY id_vendedor`,
    )
    console.log(`=== Cadastros 207727 e 266629 ===`)
    r.rows.forEach((row) => {
      console.log(JSON.stringify(row, null, 2))
      console.log("---")
    })
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
