// VHSys account probe — read-only.
// Inspeciona uma conta VHSys sem exigir migração ou refator do projeto. Útil para:
//   - validar tokens novos antes de plugar uma empresa no sync
//   - dimensionar volume de contas a pagar (paging.total)
//   - listar categorias financeiras e centros de custo (referenciados por contas_pagar)
//
// USO:
//   npx tsx --env-file=.env.local scripts/vhsys-probe.ts --empresa rigel_fabricante
//   npx tsx --env-file=.env.local scripts/vhsys-probe.ts --empresa rigel_medical
//   npx tsx --env-file=.env.local scripts/vhsys-probe.ts --empresa hdslim
//
// Lê tokens das envs por prefixo (NUNCA imprime os valores):
//   rigel_fabricante → VHSYS_ACCESS_TOKEN           + VHSYS_SECRET_ACCESS_TOKEN
//   rigel_medical    → VHSYS_RIGEL_MEDICAL_ACCESS_TOKEN + VHSYS_RIGEL_MEDICAL_SECRET_ACCESS_TOKEN
//   hdslim           → VHSYS_HDSLIM_ACCESS_TOKEN        + VHSYS_HDSLIM_SECRET_ACCESS_TOKEN

const VHSYS_BASE_URL = "https://api.vhsys.com.br/v2"

const EMPRESA_ENV_PREFIX: Record<string, string> = {
  rigel_fabricante: "VHSYS",
  rigel_medical: "VHSYS_RIGEL_MEDICAL",
  hdslim: "VHSYS_HDSLIM",
}

interface Paging {
  total?: number
  total_count?: number
  offset?: number
  limit?: number
}

interface VHSysResponse<T> {
  code: number
  status: string
  data: T
  paging?: Paging
}

function parseArgs(): { empresa: string } {
  const args = process.argv.slice(2)
  const idx = args.indexOf("--empresa")
  if (idx === -1 || !args[idx + 1]) {
    console.error("ERRO: informe --empresa <slug>")
    console.error("Slugs aceitos:", Object.keys(EMPRESA_ENV_PREFIX).join(", "))
    process.exit(1)
  }
  const empresa = args[idx + 1]
  if (!EMPRESA_ENV_PREFIX[empresa]) {
    console.error(`ERRO: slug "${empresa}" desconhecido.`)
    console.error("Slugs aceitos:", Object.keys(EMPRESA_ENV_PREFIX).join(", "))
    process.exit(1)
  }
  return { empresa }
}

function getTokens(empresa: string): { accessToken: string; secretToken: string; envPrefix: string } {
  const envPrefix = EMPRESA_ENV_PREFIX[empresa]
  const accessTokenEnv = `${envPrefix}_ACCESS_TOKEN`
  const secretTokenEnv = `${envPrefix}_SECRET_ACCESS_TOKEN`
  const accessToken = process.env[accessTokenEnv]
  const secretToken = process.env[secretTokenEnv]
  if (!accessToken || !secretToken) {
    console.error(`ERRO: ${accessTokenEnv} e/ou ${secretTokenEnv} não definidos no ambiente.`)
    console.error("Adicione em .env.local e rode com `npx tsx --env-file=.env.local ...`.")
    process.exit(1)
  }
  return { accessToken, secretToken, envPrefix }
}

async function vhsysGet<T>(
  endpoint: string,
  tokens: { accessToken: string; secretToken: string },
  params?: Record<string, string>,
): Promise<VHSysResponse<T>> {
  const url = new URL(`${VHSYS_BASE_URL}${endpoint}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "access-token": tokens.accessToken,
      "secret-access-token": tokens.secretToken,
      "Content-Type": "application/json",
      "User-Agent": "Rigel-Probe/1.0",
      "Cache-Control": "no-cache",
    },
  })
  if (!res.ok) {
    throw new Error(`VHSys GET ${endpoint} → ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as VHSysResponse<T>
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—"
  const v = typeof n === "number" ? n : Number(n)
  if (!Number.isFinite(v)) return String(n)
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmt(s: unknown, max = 40): string {
  if (s === null || s === undefined) return "—"
  const str = String(s)
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}

interface ContaPagar {
  id_conta_pag?: number
  nome_conta?: string | null
  nome_fornecedor?: string | null
  valor_pag?: number | string | null
  vencimento_pag?: string | null
  data_pagamento?: string | null
  data_emissao?: string | null
  liquidado_pag?: string | null
  categoria_pag?: string | null
  centro_custos_pag?: string | null
  data_cad_pag?: string | null
  data_mod_pag?: string | null
}

interface CategoriaFin {
  id_categoria?: number
  desc_categoria?: string
  tipo_categoria?: string
}

interface CentroCusto {
  id_centro_custos?: number
  desc_centro_custos?: string
  status_centro_custos?: string
}

interface Webhook {
  id_webhook?: number
  url_webhook?: string
  evento_webhook?: string
  status_webhook?: string
  data_cad_webhook?: string
}

async function main() {
  const { empresa } = parseArgs()
  const tokens = getTokens(empresa)
  const t0 = Date.now()

  console.log(`╔════════════════════════════════════════════════════════════════════╗`)
  console.log(`  VHSys probe — empresa: ${empresa}`)
  console.log(`  env prefix: ${tokens.envPrefix}_ACCESS_TOKEN / ${tokens.envPrefix}_SECRET_ACCESS_TOKEN`)
  console.log(`╚════════════════════════════════════════════════════════════════════╝`)

  // 1) Total de contas a pagar
  console.log("\n── 1. Contas a pagar — total ──")
  const countRes = await vhsysGet<ContaPagar[]>("/contas-pagar", tokens, { limit: "1" })
  const totalContas = countRes.paging?.total ?? countRes.paging?.total_count ?? "?"
  console.log(`  Total no VHSys: ${totalContas}`)

  // 2) Top 5 contas a pagar mais recentes
  console.log("\n── 2. Contas a pagar — 5 mais recentes (por data_cad_pag desc) ──")
  const recentes = await vhsysGet<ContaPagar[]>("/contas-pagar", tokens, {
    limit: "5",
    order: "data_cad_pag",
    sort: "desc",
  })
  for (const c of recentes.data ?? []) {
    console.log(
      `  id=${c.id_conta_pag} | venc=${fmt(c.vencimento_pag, 10)} | cad=${fmt(c.data_cad_pag, 10)} | mod=${fmt(c.data_mod_pag, 19)}\n` +
        `    fornecedor="${fmt(c.nome_fornecedor)}" | valor=${fmtMoney(c.valor_pag)} | liq=${fmt(c.liquidado_pag, 4)} | cat="${fmt(c.categoria_pag, 25)}" | centro="${fmt(c.centro_custos_pag, 25)}"`,
    )
  }
  const mostRecentMod = (recentes.data ?? [])
    .map((c) => c.data_mod_pag)
    .filter((s): s is string => !!s)
    .sort()
    .at(-1)
  if (mostRecentMod) console.log(`\n  ► Watermark sugerido para incremental: ${mostRecentMod}`)

  // 3) Top 5 contas a pagar mais antigas
  console.log("\n── 3. Contas a pagar — 5 mais antigas (por data_cad_pag asc) ──")
  const antigas = await vhsysGet<ContaPagar[]>("/contas-pagar", tokens, {
    limit: "5",
    order: "data_cad_pag",
    sort: "asc",
  })
  for (const c of antigas.data ?? []) {
    console.log(
      `  id=${c.id_conta_pag} | venc=${fmt(c.vencimento_pag, 10)} | cad=${fmt(c.data_cad_pag, 10)}` +
        ` | fornecedor="${fmt(c.nome_fornecedor)}" | valor=${fmtMoney(c.valor_pag)}`,
    )
  }
  const oldestCad = (antigas.data ?? [])
    .map((c) => c.data_cad_pag)
    .filter((s): s is string => !!s)
    .sort()
    .at(0)
  if (oldestCad) console.log(`\n  ► Registro mais antigo: ${oldestCad}`)

  // 4) Categorias financeiras
  console.log("\n── 4. Categorias financeiras ──")
  try {
    const cats = await vhsysGet<CategoriaFin[]>("/categorias-financeiras", tokens, { limit: "250" })
    const list = cats.data ?? []
    console.log(`  Total: ${cats.paging?.total ?? list.length}`)
    for (const c of list.slice(0, 30)) {
      console.log(`  id=${c.id_categoria} | tipo=${fmt(c.tipo_categoria, 12)} | desc="${fmt(c.desc_categoria, 50)}"`)
    }
    if (list.length > 30) console.log(`  … (${list.length - 30} a mais)`)
  } catch (err) {
    console.log(`  (falhou: ${err instanceof Error ? err.message : String(err)})`)
  }

  // 5) Centros de custo
  console.log("\n── 5. Centros de custo ──")
  try {
    const ccs = await vhsysGet<CentroCusto[]>("/centros-custo", tokens, { limit: "250" })
    const list = ccs.data ?? []
    console.log(`  Total: ${ccs.paging?.total ?? list.length}`)
    for (const c of list.slice(0, 30)) {
      console.log(`  id=${c.id_centro_custos} | status=${fmt(c.status_centro_custos, 8)} | desc="${fmt(c.desc_centro_custos, 60)}"`)
    }
    if (list.length > 30) console.log(`  … (${list.length - 30} a mais)`)
  } catch (err) {
    console.log(`  (falhou: ${err instanceof Error ? err.message : String(err)})`)
  }

  // 6) Webhooks registrados
  console.log("\n── 6. Webhooks registrados nesta conta VHSys ──")
  try {
    const hooks = await vhsysGet<Webhook[]>("/webhooks", tokens, { limit: "250" })
    const list = hooks.data ?? []
    if (list.length === 0) {
      console.log("  Nenhum webhook configurado.")
    } else {
      console.log(`  Total: ${hooks.paging?.total ?? list.length}`)
      for (const h of list) {
        console.log(
          `  id=${h.id_webhook} | status=${fmt(h.status_webhook, 10)} | evento=${fmt(h.evento_webhook, 30)} | url="${fmt(h.url_webhook, 80)}"`,
        )
      }
    }
  } catch (err) {
    console.log(`  (falhou: ${err instanceof Error ? err.message : String(err)})`)
  }

  console.log(`\n✓ Probe concluído em ${Date.now() - t0}ms`)
}

main().catch((err) => {
  console.error("✗ Probe falhou:", err)
  process.exit(1)
})
