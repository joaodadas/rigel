// Script descartável para o rollout de 2026-05-19:
// chama runInitialContasPagarSync(<empresa>) sem precisar de dev server.
// Uso:
//   npx tsx --env-file=.env.local scripts/run-initial-contas-pagar.ts rigel_medical
//   npx tsx --env-file=.env.local scripts/run-initial-contas-pagar.ts hdslim

import { runInitialContasPagarSync } from "../src/lib/sync/initial"
import { isEmpresaSlug } from "../src/lib/empresas"

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error("Usage: npx tsx scripts/run-initial-contas-pagar.ts <empresa-slug>")
    process.exit(1)
  }
  if (!isEmpresaSlug(slug)) {
    console.error(`Slug inválido: ${slug}. Aceitos: rigel_fabricante, rigel_medical, hdslim`)
    process.exit(1)
  }

  console.log(`▶ runInitialContasPagarSync("${slug}") starting...`)
  const t0 = Date.now()
  const result = await runInitialContasPagarSync(slug)
  console.log(`✓ Done in ${Date.now() - t0}ms:`, result)
}

main().catch((err) => {
  console.error("✗ Sync failed:", err)
  process.exit(1)
})
