# VHSys multi-empresa — contas a pagar (Rigel Medical e HD Slim)

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-05-19
**Escopo:** sincronizar `contas_pagar` de duas novas instâncias VHSys (Rigel Medical e HD Slim) e expor filtro por empresa na UI, sem quebrar o que já existe para a Rigel Fabricante.

---

## 1. Contexto e objetivo

Hoje o projeto Rigel sincroniza dados de **uma única conta VHSys** (Rigel Fabricante) para o Supabase via cron incremental a cada 30 min. O grupo opera sob mais dois CNPJs com contas VHSys próprias: **Rigel Medical** e **HD Slim**. Para esta entrega, queremos:

1. Sincronizar **somente `contas_pagar`** das duas empresas novas (escopo deliberadamente enxuto).
2. Permitir filtrar a página de contas a pagar entre: `Todos`, `Rigel Fabricante`, `Rigel Medical`, `HD Slim`.
3. Não introduzir regressão alguma na operação atual (Rigel Fabricante segue funcionando como hoje).

Decisões de produto que sustentam o design:

- **Backfill completo das duas empresas novas** — todo o histórico de `contas_pagar` delas vai para o Supabase, igual ao que já existe para a Rigel.
- **Todos os usuários veem as 3 empresas** — não há RBAC por CNPJ. Filtro é UI pura.
- **Modo "Todos" = consolidado** — soma os três num número único; não muda o layout dos cards/tabelas.
- **Filtro por página, não persistente** — sem header global, sem cookie, sem fixação por usuário. Cada acesso à página começa em "Todos".

Probe executado contra as 3 contas VHSys confirma os volumes:

| Empresa            | contas_pagar | Mais antiga | Última modificação    |
|--------------------|--------------|-------------|------------------------|
| Rigel Fabricante   | 35.813       | 2020-11-05  | 2026-05-19 10:49      |
| Rigel Medical      | 1.184        | 2026-01-07  | 2026-05-19 11:12      |
| HD Slim            | 923          | 2025-06-03  | 2026-05-19 10:23      |
| **Combinado**      | **37.920**   |             |                        |

Adicionar as duas é **+5,9% de volume**. Nenhuma das 3 tem webhook configurado no painel do VHSys. IDs de `id_conta_pag` aparentam ser globais (faixas próximas entre as 3 contas), mas vamos modelar como se pudessem colidir — PK composta `(empresa, id_conta_pag)`.

---

## 2. Decisões de arquitetura

### 2.1 Registry estático de empresas

Novo arquivo `src/lib/empresas.ts` centraliza a lista de tenants:

```ts
export const EMPRESAS = [
  { slug: "rigel_fabricante", nome: "Rigel Fabricante", envPrefix: "VHSYS" },
  { slug: "rigel_medical",    nome: "Rigel Medical",    envPrefix: "VHSYS_RIGEL_MEDICAL" },
  { slug: "hdslim",           nome: "HD Slim",          envPrefix: "VHSYS_HDSLIM" },
] as const
export type EmpresaSlug = typeof EMPRESAS[number]["slug"]
export const EMPRESA_SLUGS = EMPRESAS.map(e => e.slug) as readonly EmpresaSlug[]
```

- O `slug` é o valor que vai para a coluna `empresa` no banco e para a querystring.
- A Rigel Fabricante **mantém os envs atuais** (`VHSYS_ACCESS_TOKEN`/`VHSYS_SECRET_ACCESS_TOKEN`) — sem renomear, sem retrabalho.
- As novas usam: `VHSYS_RIGEL_MEDICAL_ACCESS_TOKEN`/`_SECRET_ACCESS_TOKEN` e `VHSYS_HDSLIM_ACCESS_TOKEN`/`_SECRET_ACCESS_TOKEN`.

### 2.2 Modelagem do banco: PK composta `(empresa, id_conta_pag)`

A coluna `empresa` entra **apenas em `contas_pagar` e `sync_log`** nesta entrega. As demais tabelas (`clientes`, `pedidos`, `produtos`, `vendedores`, `contas_receber`, `notas_fiscais`, `orcamentos`, `pedido_itens`) **permanecem single-tenant** — só recebem dados da Rigel Fabricante e não ganham coluna nova. Quando alguma delas precisar virar multi-tenant no futuro, sobe uma migration nova então.

Justificativa: minimiza superfície de mudança nesta entrega. O custo é uma migration adicional no futuro caso o escopo cresça — aceitável.

Trade-off da PK composta: força todas as queries de `contas_pagar` a passarem `empresa` (ou `IN (...)` para o modo "Todos"). Esse é o ponto: filtra automaticamente; modo "Todos" é só um `.in("empresa", EMPRESA_SLUGS)`.

### 2.3 Categorias financeiras e centros de custo: sem normalização

O schema atual de `contas_pagar` já guarda `id_categoria + categoria_pag` e `id_centro_custos + centro_custos_pag` desnormalizados (texto vem junto da API VHSys). Não há FK no banco para `categorias_financeiras` ou `centros_custo` — essas tabelas nem existem no Supabase.

Decisão: **não sincronizamos `/categorias-financeiras` nem `/centros-custo`**. Continua tudo desnormalizado dentro de `contas_pagar`. Consolidação cross-empresa (ex.: somar "Despesas com Energia Elétrica" das 3) será trabalho futuro via agrupamento por **descrição**, não por ID — porque IDs de categoria diferem entre VHSys mas descrições batem (probe confirmou).

### 2.4 Webhook: fora do escopo

Nenhuma das 3 contas VHSys tem webhook configurado (probe confirmou). O endpoint `POST /api/webhooks/vhsys` permanece existindo e funcional para a Rigel Fabricante caso seja ativado no futuro — não recebe chamadas hoje. Inserts via webhook ganhariam `empresa='rigel_fabricante'` por default (single-tenant) — sem regressão.

Tornar o webhook multi-tenant exigiria endpoint por empresa (`/api/webhooks/vhsys/[empresa]`), auth/HMAC, e configuração em cada conta VHSys. Sai desta entrega.

### 2.5 Filtro UI: por página, não persistente

- Aparece apenas em `/financeiro/contas-pagar` e `/admin/contas-pagar` (ambas usam o mesmo componente `ContasPagarTable`).
- Implementado como `<Select>` shadcn na toolbar, à esquerda do campo de busca.
- Estado controlado via querystring `?empresa=<slug>` (vazio = todos). Default no carregamento da página = todos.
- Coluna "Empresa" na tabela só aparece quando o filtro está em "Todos" (sem ele a coluna é redundante).

---

## 3. Migration: `0003_contas_pagar_multi_empresa.sql`

```sql
-- contas_pagar: ganha empresa (default rigel_fabricante para registros existentes)
ALTER TABLE contas_pagar
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

-- Após backfill (default já preencheu), remove o default para forçar inserts explícitos:
ALTER TABLE contas_pagar ALTER COLUMN empresa DROP DEFAULT;

-- Troca PK para composta (empresa, id_conta_pag)
ALTER TABLE contas_pagar DROP CONSTRAINT contas_pagar_pkey;
ALTER TABLE contas_pagar ADD PRIMARY KEY (empresa, id_conta_pag);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_venc
  ON contas_pagar (empresa, vencimento_pag DESC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_lixeira_venc
  ON contas_pagar (empresa, lixeira, vencimento_pag DESC)
  WHERE lixeira = 'Nao';

-- sync_log: ganha empresa para watermarks por tenant
ALTER TABLE sync_log
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

ALTER TABLE sync_log ALTER COLUMN empresa DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_sync_log_entity_empresa_time
  ON sync_log (entity, empresa, last_sync_at DESC);
```

**Reversibilidade:** rodar antes de qualquer insert das novas empresas → segura (`DROP COLUMN empresa` e recriação da PK antiga, sem perda).

---

## 4. Refatoração do código

### 4.1 `src/lib/vhsys/client.ts`

Todas as funções ganham `empresa: EmpresaSlug` como primeiro parâmetro **obrigatório**:

```ts
export async function vhsysGet<T>(empresa: EmpresaSlug, endpoint: string, params?: ...): Promise<...>
export async function vhsysFetchAll<T>(empresa: EmpresaSlug, endpoint: string, extraParams?: ...): Promise<T[]>
// ... idem para Post/Put/Delete
```

`getHeaders(empresa)` resolve o token via `EMPRESAS.find(e => e.slug === empresa).envPrefix` e lança erro claro se a env não estiver definida.

### 4.2 `src/lib/sync/initial.ts`

- `syncEntity()` ganha parâmetro `empresa`. Upsert injeta `empresa: <slug>` no objeto e usa `onConflict: "empresa,id_<pk>"`.
- `runInitialSync()` continua sincronizando as 6 entidades **apenas para `rigel_fabricante`** — comportamento atual preservado, só ganhando o slug no upsert.
- **Nova função** `runInitialContasPagarSync(empresa: EmpresaSlug)` — sincroniza apenas `contas_pagar` para a empresa indicada. Usada uma vez por empresa nova no rollout.

### 4.3 `src/lib/sync/incremental.ts`

O loop principal passa a iterar empresas:

```ts
for (const empresa of EMPRESAS) {
  const entities = empresa.slug === "rigel_fabricante"
    ? ENTITIES
    : ENTITIES.filter(e => e.name === "contas_pagar")
  for (const entity of entities) {
    // ... lastSync com .eq("empresa", empresa.slug)
    // ... upsert com empresa: empresa.slug, onConflict: "empresa,id_..."
    // ... sync_log insert com empresa: empresa.slug
  }
}
```

`getLastSyncTime()` ganha parâmetro `empresa` e filtra `sync_log` por ele (e o fallback `MAX(date_field)` da tabela também filtra por empresa).

### 4.4 `src/lib/queries/contas-pagar.ts`

Assinatura nova:
```ts
export async function getContasPagar(
  page = 1,
  pageSize = 50,
  search?: string,
  empresas?: EmpresaSlug[],
): Promise<ContasPagarResult>
```

- `empresas` ausente, `undefined` ou array vazio → modo "Todos": `.in("empresa", EMPRESA_SLUGS)`.
- `empresas` com 1+ slugs → `.in("empresa", empresas)`.
- Retorna `ContaPagarRow` com novo campo `empresa: EmpresaSlug`.

### 4.5 `src/lib/redis/client.ts`

`CACHE_KEYS.list` ganha sufixo de empresa:
```ts
list: (entity, page, size, search?, empresas?: string[]) =>
  `list:${entity}:p${page}:s${size}:${search || "_"}:${empresas?.length ? empresas.sort().join(",") : "_all"}`
```

`invalidateAllCaches()` itera as combinações de empresa para `contas-pagar`: para cada subconjunto razoável (todos + cada empresa isolada), invalida as primeiras 5 páginas × pageSizes comuns. Total: ~60 keys adicionais — desprezível.

### 4.6 UI: `ContasPagarTable` + páginas

**Páginas** (`admin/contas-pagar/page.tsx` e `financeiro/contas-pagar/page.tsx`):
- Lêem `empresa` do `searchParams` (CSV: `?empresa=rigel_medical` ou `?empresa=rigel_fabricante,hdslim`).
- Parseiam para `EmpresaSlug[]` (filtrando slugs inválidos).
- Passam para `getContasPagar(...)` e para o componente.

**`ContasPagarTable`:**
- Nova prop `empresas: EmpresaSlug[]` (vazio = "Todos").
- Renderiza `<Select>` com opções `Todos / Rigel Fabricante / Rigel Medical / HD Slim` no topo. Mudança → `router.push("?empresa=...")`.
- Coluna `Empresa` aparece em `columns` condicional via `Cell` extra renderizada só quando `empresas.length !== 1`.

### 4.7 Endpoint manual de sync inicial

`POST /api/sync/initial/contas-pagar?empresa=<slug>` em `src/app/api/sync/initial/contas-pagar/route.ts`:
- Gate por `CRON_SECRET` (header `Authorization: Bearer ${CRON_SECRET}`), padrão do projeto.
- Valida slug contra `EMPRESA_SLUGS`.
- Chama `runInitialContasPagarSync(empresa)` e retorna stats.
- Idempotente (upsert).

---

## 5. Rollout

Sequência em produção:

1. **Migration:** subir `0003_contas_pagar_multi_empresa.sql` no Supabase via `scripts/run-migration.ts` (ou painel SQL). Default `'rigel_fabricante'` preenche tudo; sem efeito visível para usuários.
2. **Envs:** adicionar as 4 envs novas no Vercel (`VHSYS_RIGEL_MEDICAL_*`, `VHSYS_HDSLIM_*`).
3. **Deploy do código** (cliente, sync, queries, UI). Tudo continua mostrando só Rigel Fabricante porque ainda não há dados das outras duas.
4. **Sync inicial das novas (manual):**
   ```
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "$PROD_URL/api/sync/initial/contas-pagar?empresa=rigel_medical"
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "$PROD_URL/api/sync/initial/contas-pagar?empresa=hdslim"
   ```
   Cada um leva poucos segundos (<10s pelo volume estimado).
5. **Próximo cron incremental** (30 min): confirma que ele agora cobre as 3.
6. **Flush manual do Redis** (opcional, acelera ver os dados novos sem esperar TTL): `await redis.flushdb()` via console Upstash, ou esperar 1h.

---

## 6. Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Query existente não atualizada → mostra mistura sem filtro | Média | Default `'rigel_fabricante'` na migration faz queries antigas continuarem retornando o subset correto. PR review focado em todos os `from("contas_pagar")`. |
| Cron incremental estoura timeout do Vercel | Baixa | Volume das duas novas é <2.500 registros; <10 páginas combinadas; soma ~3-5s ao tempo total. |
| Slug typo passa para o banco | Baixa | CHECK constraint na coluna rejeita; type `EmpresaSlug` rejeita no TS. |
| Webhook da Rigel ativado depois quebra com PK composta | Baixa | `handleVHSysWebhook` faz upsert; default `'rigel_fabricante'` cobre. Reavaliado se webhook for ativado. |
| `pedido_itens.ts` lê env direto (`VHSYS_ACCESS_TOKEN`) | Não bloqueia | Só opera na Rigel Fabricante; comentário `TODO multi-empresa` adicionado. |
| Cache não invalidado retorna lista errada após sync | Baixa | `invalidateAllCaches` cobre todas as variações de empresa após cada sync. |

---

## 7. Fora do escopo (follow-ups identificados)

- Sync de outras tabelas (clientes, pedidos, produtos, vendedores, contas_receber, notas_fiscais, orcamentos, pedido_itens) para Rigel Medical e HD Slim.
- Webhook multi-tenant + endpoint por empresa + HMAC.
- Mapeamento/consolidação de categorias financeiras entre empresas no BI.
- Conciliação dos slugs de `dre_lancamentos` (`matriz/filial/medical/hdslim/consolidado`) com os slugs VHSys (`rigel_fabricante/rigel_medical/hdslim`). Hoje DRE é alimentado por upload manual e não cruza com dados VHSys.
- Tratamento de intercompany (HD Slim tem "RIGEL FABRICANTE..." como fornecedor recorrente).
- `VENDEDOR_ID_TO_CANONICAL` permanece exclusivo da Rigel Fabricante; expansão para outras empresas só quando elas começarem a sincronizar pedidos.
- Refator de `src/lib/sync/pedido-itens.ts` para usar o client multi-empresa (hoje lê env direto).

---

## 8. Critérios de aceitação

- `npm run build` passa.
- `npm run lint` passa.
- Migration aplicada sem erro; `SELECT empresa, COUNT(*) FROM contas_pagar GROUP BY empresa` mostra `rigel_fabricante` com 35.813 antes do sync das novas.
- Após sync inicial das duas novas, mesmo SELECT mostra as 3 com totais batendo com `paging.total` do probe (±diferença natural entre execuções).
- `/financeiro/contas-pagar` (e `/admin/contas-pagar`) renderiza o filtro de empresa.
- Filtro "Todos" mostra ~37.920 contas (lixeira=Nao); "Rigel Medical" mostra ~1.184; "HD Slim" mostra ~923.
- Coluna "Empresa" aparece só no modo "Todos".
- Próximo cron incremental após sync inicial registra `sync_log` com 3 empresas distintas.
- Webhook endpoint atual continua respondendo 200 para payloads simulados da Rigel Fabricante (sem regressão).
