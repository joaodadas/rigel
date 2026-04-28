import { Pool } from "pg"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("usage: tsx scripts/run-migration.ts <path/to/migration.sql>")
    process.exit(1)
  }
  const sql = readFileSync(resolve(file), "utf-8")
  console.log(`Running migration: ${file}`)
  console.log(`SQL (${sql.length} chars):\n${sql}\n---`)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await pool.query(sql)
    console.log("Migration applied OK.")
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error("Migration failed:", e)
  process.exit(1)
})
